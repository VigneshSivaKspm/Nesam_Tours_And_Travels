import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

// Compile the actual production operations for Node, injecting only the SDK/db.
const requireAdmin = createRequire(new URL('../../admin/package.json', import.meta.url));
const ts = requireAdmin('typescript');
const sdk = requireAdmin('firebase/firestore');
const appSdk = requireAdmin('firebase/app');
const source = readFileSync(new URL('../../admin/src/services/marketplaceOperations.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
new Function('require', 'exports', compiled)(requireAdmin, exports);
let env, app, db, ops;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-nesam-marketplace', firestore: { rules: 'rules_version = "2"; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }', host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8089) } });
  await env.clearFirestore();
  app = appSdk.initializeApp({ projectId: 'demo-nesam-marketplace', apiKey: 'demo', appId: 'demo' }, 'marketplace-test');
  db = sdk.getFirestore(app);
  sdk.connectFirestoreEmulator(db, '127.0.0.1', Number(process.env.FIRESTORE_EMULATOR_PORT || 8089));
  ops = exports.createMarketplaceService(db);
});
after(async () => { await sdk.terminate(db); await appSdk.deleteApp(app); await env?.cleanup(); });
const put = (path, data) => sdk.setDoc(sdk.doc(db, path), data);
const get = async path => (await sdk.getDoc(sdk.doc(db, path))).data();
async function seed(id) {
  await put(`bookings/${id}`, { bookingId: `DISPLAY-${id}`, status: 'Pending', fare: 1000, pickup: 'A', drop: 'B' });
  await put(`marketplace_trips/${id}`, { status: 'Bidding', offeredPayout: 850 });
  await put('vendors/vendor1', { status: 'APPROVED' });
  await put('vendors/vendor2', { status: 'APPROVED' });
  for (const n of [1, 2]) await put(`marketplace_trips/${id}/bids/bid${n}`, { status: 'Pending Review', vendorId: `vendor${n}`, vendorName: `V${n}`, vendorCounterRate: 900 });
}
test('admin: real Pending Review bid awards the document ID and resolves competing bids', async () => {
  await seed('award1');
  await ops.awardBid('award1', 'bid1');
  assert.equal((await get('bookings/award1')).status, 'Confirmed');
  assert.equal((await get('bookings/award1')).vendorPayout, 900);
  assert.equal((await get('marketplace_trips/award1')).status, 'Assigned');
  assert.equal((await get('marketplace_trips/award1/bids/bid2')).status, 'Rejected');
  assert.equal(await get('bookings/DISPLAY-award1'), undefined);
});
test('admin: racing awards have exactly one winner', async () => {
  await seed('award2');
  const results = await Promise.allSettled([ops.awardBid('award2', 'bid1'), ops.awardBid('award2', 'bid2')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});
test('admin: rejecting one bid leaves the trip available; posting resolves display code', async () => {
  await seed('award3');
  await ops.rejectBid('award3', 'bid1');
  assert.equal((await get('marketplace_trips/award3')).status, 'Bidding');
  await put('bookings/post1', { bookingId: 'DISPLAY-POST', status: 'Pending', fare: 1000, pickup: 'A', drop: 'B' });
  await ops.postBooking('DISPLAY-POST', 850);
  assert.equal((await get('marketplace_trips/post1')).offeredPayout, 850);
  assert.equal((await get('bookings/post1')).fareVerified, true);
  await assert.rejects(ops.postBooking('DISPLAY-POST', 1001), /within/);
});

const paymentSource = readFileSync(new URL('../../admin/src/services/paymentReconciliation.ts', import.meta.url), 'utf8');
const paymentExports = {};
new Function('require', 'exports', ts.transpileModule(paymentSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(requireAdmin, paymentExports);
test('admin: payment reconciliation rejects wrong amounts and unapproved tolls, records once', async () => {
  await put('bookings/pay1', { status: 'Completed', fareVerified: true, fare: 1000, tollCharges: 50, paymentMethod: 'UPI', payment: 'Pending' });
  const reconcile = (amount, tolls) => paymentExports.reconcilePayment(db, 'pay1', amount, 'BANK-REF-1', tolls, 'admin1');
  await assert.rejects(reconcile('1000', true), /Expected received/);
  await assert.rejects(reconcile('1050', false), /toll receipts/);
  const results = await Promise.allSettled([reconcile('1050', true), reconcile('1050', true)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await get('bookings/pay1')).payment, 'Paid');
  assert.equal((await get('payments/booking_pay1')).amount, 1050);
  assert.equal((await get('payments/booking_pay1')).verifiedBy, 'admin1');
});
test('admin: cash and unverified fares cannot become platform payout balance', async () => {
  await put('bookings/pay2', { status: 'Completed', fareVerified: true, fare: 1000, paymentMethod: 'Cash' });
  await assert.rejects(paymentExports.reconcilePayment(db, 'pay2', '1000', 'BANK-REF', false, 'admin1'), /Cash/);
  await put('bookings/pay3', { status: 'Completed', fare: 1000, paymentMethod: 'UPI' });
  await assert.rejects(paymentExports.reconcilePayment(db, 'pay3', '1000', 'BANK-REF', false, 'admin1'), /review its fare/);
});
