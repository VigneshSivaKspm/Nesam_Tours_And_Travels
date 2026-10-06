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
// Awarding a bid and posting a booking decide a partner payout, so they run on
// the server (finance.test.mjs). Rejecting a bid is the only client operation.
test('admin: rejecting one bid leaves the trip and the other bids open', async () => {
  await seed('award3');
  await ops.rejectBid('award3', 'bid1');
  assert.equal((await get('marketplace_trips/award3/bids/bid1')).status, 'Rejected');
  assert.equal((await get('marketplace_trips/award3/bids/bid2')).status, 'Pending Review');
  assert.equal((await get('marketplace_trips/award3')).status, 'Bidding');
  assert.equal((await get('bookings/award3')).status, 'Pending');
});
// Payment recording moved to the recordPayment function; it is covered by workflow.test.mjs.
