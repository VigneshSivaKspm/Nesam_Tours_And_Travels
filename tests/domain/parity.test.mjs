// The admin panel keeps a small client copy of the booking vocabulary. The
// server copy is authoritative; this fails if they ever disagree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const server = require('../../functions/lib/domain/bookingFlow.js');
const client = await import('../../admin/src/domain/bookingFlow.ts');

const STATUSES = ['Pending', 'Approved', 'Confirmed', 'Assigned', 'Ongoing', 'Completed', 'Cancelled', 'Rejected', 'weird', undefined];

test('tabs agree for every status', () => {
  for (const s of STATUSES) assert.equal(client.tabOf(s), server.tabOf(s), String(s));
});

test('trip sub-status mapping agrees, including legacy stages', () => {
  const stages = [undefined, 'Assigned', 'En Route Pickup', 'Reached Pickup', 'In Progress', 'Arrived Destination', 'Completed'];
  for (const tripStage of stages) for (const status of ['Assigned', 'Ongoing', 'Completed']) {
    assert.equal(client.tripSubStatusOf({ tripStage, status }), server.tripSubStatusOf({ tripStage, status }), `${tripStage}/${status}`);
  }
  for (const tripSubStatus of ['Not Started', 'Trip Started', 'Reached Pickup', 'Trip Ended']) {
    assert.equal(client.tripSubStatusOf({ tripSubStatus }), server.tripSubStatusOf({ tripSubStatus }));
  }
});

test('payment summaries agree', () => {
  const cases = [
    [10000, []],
    [10000, [{ amount: 2000, method: 'UPI', kind: 'advance', collectorType: 'admin' }]],
    [10000, [{ amount: 2000, method: 'UPI', kind: 'advance', collectorType: 'admin' }, { amount: 3000, method: 'Cash', collectorType: 'driver' }, { amount: 5000, method: 'Bank Transfer', collectorType: 'admin' }]],
    [10000, [{ amount: 6000, method: 'Cash', status: 'Voided' }, { amount: 100.5, method: 'UPI' }]],
    [0, [{ amount: 400, method: 'UPI' }], { status: 'Completed', amount: 400 }],
    [5000, [{ amount: 400, method: 'UPI' }], { status: 'Pending', amount: 300 }],
  ];
  for (const [due, txns, refund] of cases) assert.deepEqual(client.summarizePayments(due, txns, refund), server.summarizePayments(due, txns, refund));
  for (const b of [{ fare: 10000, tollCharges: 300, status: 'Completed' }, { fare: '₹1,500', status: 'Ongoing' }, {}]) assert.equal(client.amountDueFor(b), server.amountDueFor(b));
});

test('legacy bookings without a summary still show a payment picture', () => {
  assert.equal(client.paymentOf({ fare: 900, payment: 'Paid', status: 'Completed' }).status, 'Paid');
  assert.equal(client.paymentOf({ fare: 900, payment: 'Paid', status: 'Completed' }).balanceDue, 0);
  assert.equal(client.paymentOf({ fare: '₹900', payment: 'Pending', status: 'Pending' }).balanceDue, 900);
});

test('alert severity and thresholds agree', () => {
  const now = 1_700_000_000_000;
  for (const status of ['Approved', 'Confirmed', 'Pending', 'Assigned'])
    for (const driver of [undefined, 'd1'])
      for (const h of [-2, 0.2, 0.9, 1, 2, 3, 3.01, 9, null]) {
        const at = h === null ? null : now + h * 3600000;
        assert.equal(client.unassignedSeverity({ status, assignedDriverId: driver }, at, now), server.unassignedSeverity({ status, assignedDriverId: driver }, at, now), `${status}/${driver}/${h}`);
      }
  for (const v of [{ warningHours: 6, criticalHours: 2 }, { warningHours: 1, criticalHours: 5 }, {}, null, { warningHours: 100 }]) assert.deepEqual(client.normalizeThresholds(v), server.normalizeThresholds(v));
});

test('penalty statuses and transitions agree', () => {
  for (const s of ['Pending', 'Acknowledged', 'Paid', 'Deducted', 'Waived', 'Disputed', 'Applied', 'Recovered', 'Reversed', 'x', undefined]) {
    assert.equal(client.penaltyStatusOf(s), server.penaltyStatusOf(s), String(s));
    // Every move the client offers must be accepted by the server.
    for (const to of client.penaltyNext(s)) assert.equal(server.penaltyBlocker(s, to), '', `${s} → ${to}`);
  }
  for (const s of ['Pending', 'Processing', 'Failed', 'Completed', 'Rejected']) {
    for (const to of client.refundNext(s)) assert.equal(server.refundBlocker(s, to), '', `${s} → ${to}`);
  }
});
