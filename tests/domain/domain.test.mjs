// Pure-logic tests for the booking domain (fare, discount, adjustment, payments,
// state machine, trip order, alerts, photo analysis). They run against the
// compiled functions: `cd functions && npm run build`, then `node --test tests/domain`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pricing = require('../../functions/lib/domain/pricing.js');
const flow = require('../../functions/lib/domain/bookingFlow.js');
const breakup = require('../../functions/lib/domain/fareBreakup.js');
const ver = require('../../functions/lib/domain/verification.js');
const time = require('../../functions/lib/domain/time.js');
const bb = require('../../functions/lib/bookingBuild.js');

// A category whose package is exactly ₹10,000 for the test route.
const category = {
  id: 'c1', name: 'Sedan', description: '', seats: 4, displayOrder: 1, matchVehicleTypes: ['sedan'],
  fare: { baseFare: 10000, baseKm: 500, perKmRate: 15, perMinuteRate: 0, minimumFare: 0, nightCharge: 0, driverAllowance: 500,
    extras: { waitingPerHour: 100, extraKmRate: 15, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 0 } },
};
const route = { distanceKm: 100, durationMin: 120, path: [], estimated: false };
const noon = new Date('2026-10-07T06:30:00Z'); // 12:00 IST (not night)
const quote = (extra = {}) => pricing.calculateFare({ category, route, tripType: 'One Way', pickupTime: noon, ...extra });

test('package fare is calculated from the category, never typed', () => {
  const f = quote();
  assert.equal(f.subtotal, 10000 + 500); // base + outstation driver allowance (100 km one way > 40)
  assert.equal(f.distanceFare, 0);
});

test('percentage discount 10% of ₹10,000 gives ₹9,000 before GST', () => {
  const f = pricing.calculateFare({ category: { ...category, fare: { ...category.fare, driverAllowance: 0 } }, route, tripType: 'One Way', pickupTime: noon, adminDiscount: { type: 'percentage', value: 10 } });
  assert.equal(f.subtotal, 10000);
  assert.equal(f.discount, 1000);
  assert.equal(f.taxableAmount, 9000);
  assert.equal(f.total, 9450); // GST 5% is added on top, as for every booking
  assert.equal(f.discountDetail.type, 'percentage');
});

test('fixed discount ₹500 gives ₹9,500 before GST, and is not combined with a percentage', () => {
  const c = { ...category, fare: { ...category.fare, driverAllowance: 0 } };
  const f = pricing.calculateFare({ category: c, route, tripType: 'One Way', pickupTime: noon, adminDiscount: { type: 'fixed', value: 500 } });
  assert.equal(f.taxableAmount, 9500);
  assert.throws(() => pricing.calculateFare({ category: c, route, tripType: 'One Way', pickupTime: noon, discount: 100, adminDiscount: { type: 'fixed', value: 500 } }), /either a coupon or an admin discount/);
});

test('a discount can never make the payable amount negative', () => {
  const c = { ...category, fare: { ...category.fare, driverAllowance: 0 } };
  const f = pricing.calculateFare({ category: c, route, tripType: 'One Way', pickupTime: noon, adminDiscount: { type: 'fixed', value: 99999 } });
  assert.equal(f.discount, 10000);
  assert.equal(f.total, 0);
});

test('global increase 10% on ₹10,000 gives ₹11,000; decrease 10% gives ₹9,000 — applied once, never compounded', () => {
  const c = { ...category, fare: { ...category.fare, driverAllowance: 0 } };
  const up = pricing.calculateFare({ category: c, route, tripType: 'One Way', pickupTime: noon, adjustment: { id: 'g', name: 'Festival', direction: 'increase', percent: 10 } });
  assert.equal(up.subtotalBeforeAdjustment, 10000);
  assert.equal(up.subtotal, 11000);
  assert.equal(up.globalAdjustment.amount, 1000);
  const down = pricing.calculateFare({ category: c, route, tripType: 'One Way', pickupTime: noon, adjustment: { id: 'g', name: 'Promo', direction: 'decrease', percent: 10 } });
  assert.equal(down.subtotal, 9000);
  // Re-quoting with the same adjustment gives the same number (it is derived from the base, not from a prior result).
  const again = pricing.calculateFare({ category: c, route, tripType: 'One Way', pickupTime: noon, adjustment: { id: 'g', name: 'Promo', direction: 'decrease', percent: 10 } });
  assert.equal(again.subtotal, down.subtotal);
});

test('discount applies to the adjusted fare, in a fixed order: package → adjustment → discount → GST', () => {
  const c = { ...category, fare: { ...category.fare, driverAllowance: 0 } };
  const f = pricing.calculateFare({ category: c, route, tripType: 'One Way', pickupTime: noon, adjustment: { id: 'g', name: 'Festival', direction: 'increase', percent: 10 }, adminDiscount: { type: 'percentage', value: 10 } });
  assert.equal(f.subtotal, 11000);
  assert.equal(f.discount, 1100);
  assert.equal(f.taxableAmount, 9900);
});

test('fare breakup states what is included and what is payable separately', () => {
  const f = quote();
  const b = breakup.buildFareBreakup(category, f, true);
  const by = Object.fromEntries(b.lines.map((l) => [l.key, l]));
  assert.equal(by.base.treatment, 'included');
  assert.match(by.base.detail, /Includes 500 KM/);
  assert.equal(by.driverAllowance.treatment, 'included');
  assert.equal(by.toll.treatment, 'extra');
  assert.equal(by.parking.treatment, 'extra');
  assert.equal(by.extraKm.treatment, 'extra');
  assert.equal(by.stateTax.treatment, 'extra');
  assert.equal(b.packageTotal, f.total);
  const local = breakup.buildFareBreakup(category, quote(), false);
  assert.equal(local.lines.find((l) => l.key === 'driverAllowance').treatment, 'not_applicable');
});

test('payments: ₹2,000 UPI + ₹3,000 cash (driver) + ₹5,000 bank (admin) on ₹10,000 = Paid, balance 0', () => {
  const txns = [
    { amount: 2000, method: 'UPI', kind: 'advance', collectorType: 'admin' },
    { amount: 3000, method: 'Cash', kind: 'partial', collectorType: 'driver' },
    { amount: 5000, method: 'Bank Transfer', kind: 'final', collectorType: 'admin' },
  ];
  const s = flow.summarizePayments(10000, txns);
  assert.equal(s.totalPaid, 10000);
  assert.equal(s.balanceDue, 0);
  assert.equal(s.status, 'Paid');
  assert.equal(s.advancePaid, 2000);
  assert.equal(s.partnerCashHeld, 3000); // only the cash the driver collected
  assert.equal(s.transactions, 3);
  assert.equal(flow.summarizePayments(10000, txns.slice(0, 1)).status, 'Partially Paid');
  assert.equal(flow.summarizePayments(10000, []).status, 'Unpaid');
});

test('voided payments no longer count; refunds drive Refund Pending / Refunded', () => {
  const t = [{ amount: 4000, method: 'UPI' }, { amount: 6000, method: 'Cash', status: 'Voided' }];
  assert.equal(flow.summarizePayments(10000, t).totalPaid, 4000);
  assert.equal(flow.summarizePayments(10000, [{ amount: 4000, method: 'UPI' }], { status: 'Pending', amount: 3500 }).status, 'Refund Pending');
  assert.equal(flow.summarizePayments(0, [{ amount: 4000, method: 'UPI' }], { status: 'Completed', amount: 4000 }).status, 'Refunded');
  assert.equal(flow.maxRefund(4000, 500), 3500);
  assert.equal(flow.maxRefund(300, 500), 0);
});

test('amount due adds tolls only once the trip has ended', () => {
  assert.equal(flow.amountDueFor({ fare: 10000, tollCharges: 300, status: 'Ongoing' }), 10000);
  assert.equal(flow.amountDueFor({ fare: '₹10,000', tollCharges: 300, status: 'Completed' }), 10300);
});

test('booking state machine: the main path and the blocked jumps', () => {
  for (const [a, b] of [['Pending', 'Approved'], ['Approved', 'Assigned'], ['Assigned', 'Ongoing'], ['Ongoing', 'Completed'], ['Pending', 'Rejected'], ['Assigned', 'Cancelled']]) {
    assert.equal(flow.canTransition(a, b), true, `${a} → ${b}`);
  }
  for (const [a, b] of [['Pending', 'Ongoing'], ['Pending', 'Assigned'], ['Approved', 'Completed'], ['Completed', 'Cancelled'], ['Cancelled', 'Approved'], ['Rejected', 'Approved']]) {
    assert.equal(flow.canTransition(a, b), false, `${a} → ${b}`);
  }
  assert.equal(flow.tabOf('Assigned'), 'Confirmed');
  assert.equal(flow.tabOf('Confirmed'), 'Confirmed');
  assert.equal(flow.tabOf('Cancelled'), null);
  assert.equal(flow.isMarketplaceVisible('Pending'), false);
  assert.equal(flow.isMarketplaceVisible('Approved'), true);
});

test('trip stages: only Reached Pickup → Trip Started → Trip Ended', () => {
  assert.equal(flow.tripStageBlocker('Not Started', 'Reached Pickup'), '');
  assert.equal(flow.tripStageBlocker('Reached Pickup', 'Trip Started'), '');
  assert.equal(flow.tripStageBlocker('Trip Started', 'Trip Ended'), '');
  assert.match(flow.tripStageBlocker('Not Started', 'Trip Started'), /next step is "Reached Pickup"/);
  assert.match(flow.tripStageBlocker('Not Started', 'Trip Ended'), /next step is "Reached Pickup"/);
  assert.match(flow.tripStageBlocker('Reached Pickup', 'Trip Ended'), /next step is "Trip Started"/);
  assert.match(flow.tripStageBlocker('Reached Pickup', 'Reached Pickup'), /already/);
  assert.match(flow.tripStageBlocker('Trip Ended', 'Trip Started'), /already ended/);
  assert.equal(flow.nextTripStep('Not Started'), 'Reached Pickup');
  assert.equal(flow.nextTripStep('Trip Ended'), null);
  assert.deepEqual(flow.LEGACY_STAGE_FOR, { 'Not Started': 'Assigned', 'Reached Pickup': 'Reached Pickup', 'Trip Started': 'In Progress', 'Trip Ended': 'Completed' });
  // A trip begun under the earlier order (driver still driving to the pickup) has not reached it yet.
  assert.equal(flow.tripSubStatusOf({ tripSubStatus: 'Trip Started', tripStage: 'En Route Pickup', status: 'Ongoing' }), 'Not Started');
  assert.equal(flow.tripSubStatusOf({ tripSubStatus: 'Trip Started', tripStage: 'In Progress', status: 'Ongoing' }), 'Trip Started');
  // Old records keep loading.
  assert.equal(flow.tripSubStatusOf({ tripStage: 'En Route Pickup' }), 'Not Started');
  assert.equal(flow.tripSubStatusOf({ tripStage: 'In Progress' }), 'Trip Started');
  assert.equal(flow.tripSubStatusOf({ status: 'Completed' }), 'Trip Ended');
  assert.equal(flow.tripSubStatusOf({}), 'Not Started');
});

test('unassigned alert severity: normal > 3 h, warning within 3 h, critical within 1 h', () => {
  const now = Date.parse('2026-10-07T10:00:00Z');
  const b = { status: 'Approved' };
  const at = (h) => now + h * 3600000;
  assert.equal(flow.unassignedSeverity(b, at(5), now), 'normal');
  assert.equal(flow.unassignedSeverity(b, at(2.5), now), 'warning');
  assert.equal(flow.unassignedSeverity(b, at(0.5), now), 'critical');
  assert.equal(flow.unassignedSeverity(b, at(-1), now), 'critical');
  assert.equal(flow.unassignedSeverity({ ...b, assignedDriverId: 'd1' }, at(0.5), now), 'none');
  assert.equal(flow.unassignedSeverity({ status: 'Pending' }, at(0.5), now), 'none');
  assert.deepEqual(flow.normalizeThresholds({ warningHours: 6, criticalHours: 2 }), { warningHours: 6, criticalHours: 2 });
  assert.deepEqual(flow.normalizeThresholds({ warningHours: 1, criticalHours: 5 }), { warningHours: 1, criticalHours: 1 });
});

test('penalty and refund transitions; legacy penalty statuses still read', () => {
  assert.equal(flow.penaltyBlocker('Pending', 'Acknowledged'), '');
  assert.equal(flow.penaltyBlocker('Acknowledged', 'Deducted'), '');
  assert.match(flow.penaltyBlocker('Paid', 'Waived'), /cannot become/);
  assert.equal(flow.penaltyStatusOf('Applied'), 'Pending');
  assert.equal(flow.penaltyStatusOf('Recovered'), 'Paid');
  assert.equal(flow.refundBlocker('Pending', 'Completed'), '');
  assert.match(flow.refundBlocker('Completed', 'Failed'), /cannot become/);
});

test('12-hour display in India time', () => {
  assert.equal(time.formatTime12(new Date('2026-10-07T13:00:00Z')), '06:30 PM');
  assert.equal(time.formatTime12(new Date('2026-10-06T23:30:00Z')), '05:00 AM');
  assert.equal(time.formatTime12(new Date('2026-10-07T06:30:00Z')), '12:00 PM');
});

test('WhatsApp and email validation', () => {
  assert.equal(bb.whatsappContact({ sameAsMobile: true }, '+919876543210').e164, '+919876543210');
  assert.equal(bb.whatsappContact({ countryCode: '+91', number: '98765 43211' }, '+919876543210').e164, '+919876543211');
  assert.equal(bb.whatsappContact({ countryCode: '+971', number: '501234567' }, '+919876543210').e164, '+971501234567');
  assert.throws(() => bb.whatsappContact({ countryCode: '+91', number: '12345' }, '+919876543210'), /valid 10-digit/);
  assert.throws(() => bb.whatsappContact({ countryCode: '91', number: '9876543211' }, '+919876543210'), /country code/);
  assert.equal(bb.optionalEmail(''), '');
  assert.equal(bb.optionalEmail('  A@B.com '), 'a@b.com');
  assert.throws(() => bb.optionalEmail('nope'), /valid email/);
  assert.equal(bb.indianPhone('+91 98765-43210'), '+919876543210');
  assert.throws(() => bb.indianPhone('12345'), /valid 10-digit/);
  assert.equal(bb.adminDiscountOf(null), null);
  assert.throws(() => bb.adminDiscountOf({ type: 'percentage', value: 120 }), /100%/);
  assert.throws(() => bb.adminDiscountOf({ type: 'fixed', value: 0 }), /greater than zero/);
});

test('photo forensics: perceptual hash is stable, differs between pictures, and flags duplicates', async () => {
  const jpeg = require('../../functions/node_modules/jpeg-js');
  const make = (fn) => {
    const w = 64, h = 64, data = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = fn(x, y); const i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; }
    return jpeg.encode({ data, width: w, height: h }, 90).data;
  };
  const gradient = make((x) => x * 4);
  const gradient2 = make((x) => Math.min(255, x * 4 + 3));
  const other = make((x, y) => ((x >> 3) + (y >> 3)) % 2 ? 230 : 20);
  const h1 = ver.perceptualHash(gradient), h2 = ver.perceptualHash(gradient2), h3 = ver.perceptualHash(other);
  assert.equal(h1.length, 16);
  assert.ok(ver.hammingDistance(h1, h2) <= ver.NEAR_DUPLICATE_DISTANCE, 'a lightly edited copy is a near-duplicate');
  assert.ok(ver.hammingDistance(h1, h3) > ver.NEAR_DUPLICATE_DISTANCE, 'a different picture is not');
  assert.notEqual(ver.sha256Hex(gradient), ver.sha256Hex(gradient2));
  assert.equal(ver.perceptualHash(Buffer.from('not a jpeg')), null);
  const sig = ver.analyzeImage(other);
  assert.ok(sig && sig.width === 64);
  assert.equal(ver.looksLikeScreenshot(1080, 2340, false), true);
  assert.equal(ver.looksLikeScreenshot(1080, 2340, true), false);
  assert.equal(ver.riskLevelOf(70), 'high');
  assert.equal(ver.riskLevelOf(30), 'medium');
  assert.equal(ver.riskLevelOf(5), 'low');
});

test('device integrity verdict: only genuine devices running the published app pass', () => {
  const expect = { packageName: 'com.nesam.driver', nonce: 'n1' };
  const good = { packageName: 'com.nesam.driver', nonce: 'n1', appRecognitionVerdict: 'PLAY_RECOGNIZED', deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] };
  assert.equal(ver.evaluateIntegrity(good, expect).ok, true);
  assert.deepEqual(ver.evaluateIntegrity({ ...good, deviceRecognitionVerdict: ['MEETS_BASIC_INTEGRITY'] }, expect).reasons, ['device_integrity_failed']);
  assert.ok(ver.evaluateIntegrity({ ...good, deviceRecognitionVerdict: [] }, expect).reasons.includes('device_integrity_failed'));
  assert.ok(ver.evaluateIntegrity({ ...good, appRecognitionVerdict: 'UNRECOGNIZED_VERSION' }, expect).reasons.includes('app_not_recognized'));
  assert.ok(ver.evaluateIntegrity({ ...good, nonce: 'other' }, expect).reasons.includes('nonce_mismatch'));
  assert.ok(ver.evaluateIntegrity({ ...good, packageName: 'com.evil' }, expect).reasons.includes('package_mismatch'));
});
