// storage.rules against the Storage emulator, with Firestore alongside for the
// cross-service checks (staff permissions, driver/vendor links, bookings).
// Runs under `firebase emulators:exec --only firestore,storage` (see run.mjs),
// which provides FIRESTORE_EMULATOR_HOST / FIREBASE_STORAGE_EMULATOR_HOST.
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const hostPort = (v, fallback) => {
  const [host, port] = (v || fallback).split(':');
  return { host, port: Number(port) };
};

let env;
const store = {};
const IMAGE = { contentType: 'image/jpeg' };
const bytes = (n = 64) => new Uint8Array(n).fill(7);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT || 'demo-nesam-storage',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), ...hostPort(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080') },
    storage: { rules: readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8'), ...hostPort(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199') },
  });
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const put = (p, d) => setDoc(doc(db, p), d);
    await put('admins/ppl', { role: 'admin', status: 'active', staffRole: 'r_p', permissions: ['people'] });
    await put('admins/ops', { role: 'admin', status: 'active', staffRole: 'r_o', permissions: ['operations'] });
    await put('admins/flt', { role: 'admin', status: 'active', staffRole: 'r_f', permissions: ['fleet'] });
    await put('admins/off', { role: 'admin', status: 'inactive' });
    for (const id of ['v1', 'v2']) await put(`vendors/${id}`, { uid: id, role: 'vendor', status: 'APPROVED' });
    await put('vendors/vDraft', { uid: 'vDraft', role: 'vendor', status: 'INCOMPLETE' });
    await put('drivers/drvA', { role: 'driver', status: 'Approved', vendorId: '' });
    await put('drivers/drvB', { role: 'driver', status: 'Approved', vendorId: '' });
    await put('drivers/fdr', { role: 'driver', status: 'Approved', vendorId: 'v1' });
    await put('bookings/trip1', { status: 'Assigned', assignedDriverId: 'drvA', customerId: 'cust1' });
    await put('bookings/fleetTrip', { status: 'Ongoing', assignedDriverId: 'fdr', assignedVendorId: 'v1', customerId: 'cust1' });
  });
  for (const id of ['ppl', 'ops', 'flt', 'off', 'v1', 'v2', 'vDraft', 'drvA', 'drvB', 'fdr', 'cust1', 'cust2']) {
    store[id] = env.authenticatedContext(id).storage();
  }
  // Existing evidence, uploaded with rules off.
  await env.withSecurityRulesDisabled(async (c) => {
    const s = c.storage();
    for (const p of ['drivers/drvA/kyc/licence-1.jpg', 'drivers/fdr/kyc/licence-1.jpg', 'drivers/drvA/trips/trip1/selfie-1.jpg',
      'drivers/fdr/trips/fleetTrip/selfie-1.jpg', 'vendors/v1/onboarding/rc/1_a_rc.pdf', 'fleet/veh1/rc-1.jpg']) {
      await s.ref(p).put(bytes(), IMAGE);
    }
  });
});

after(async () => {
  await env?.cleanup();
});

const up = (who, path, data = bytes(), meta = IMAGE) => store[who].ref(path).put(data, meta);
const read = (who, path) => store[who].ref(path).getMetadata();
const del = (who, path) => store[who].ref(path).delete();

test('driver KYC: new uploads only — approved documents are never replaced or deleted by the driver', async () => {
  await assertSucceeds(up('drvA', 'drivers/drvA/kyc/licence-2.jpg'));
  await assertFails(up('drvA', 'drivers/drvA/kyc/licence-1.jpg'));
  await assertFails(del('drvA', 'drivers/drvA/kyc/licence-1.jpg'));
  await assertFails(up('drvA', 'drivers/drvA/vehicle/rc-1.jpg', bytes(), { contentType: 'text/html' }));
  await assertSucceeds(up('drvA', 'drivers/drvA/vehicle/rc-1.jpg'));
  await assertFails(up('drvA', 'drivers/drvA/other/anything.jpg'));
  await assertFails(up('drvB', 'drivers/drvA/kyc/licence-3.jpg'));
  await assertFails(del('ops', 'drivers/drvA/kyc/licence-2.jpg'));
  await assertSucceeds(del('ppl', 'drivers/drvA/kyc/licence-2.jpg'));
});

test('driver documents: visible to the driver, staff and the driver’s own vendor only', async () => {
  await assertSucceeds(read('drvA', 'drivers/drvA/kyc/licence-1.jpg'));
  await assertSucceeds(read('ops', 'drivers/drvA/kyc/licence-1.jpg'));
  await assertFails(read('off', 'drivers/drvA/kyc/licence-1.jpg'));
  await assertFails(read('drvB', 'drivers/drvA/kyc/licence-1.jpg'));
  await assertFails(read('v1', 'drivers/drvA/kyc/licence-1.jpg'));
  await assertSucceeds(read('v1', 'drivers/fdr/kyc/licence-1.jpg'));
  await assertFails(read('v2', 'drivers/fdr/kyc/licence-1.jpg'));
  await assertFails(read('cust1', 'drivers/fdr/kyc/licence-1.jpg'));
});

test('trip evidence: only the assigned driver, only while the trip is live, never overwritten', async () => {
  await assertSucceeds(up('drvA', 'drivers/drvA/trips/trip1/odometer-1.jpg'));
  await assertSucceeds(up('drvA', 'drivers/drvA/trips/trip1/tolls/toll-1.jpg'));
  await assertFails(up('drvA', 'drivers/drvA/trips/trip1/selfie-1.jpg'));
  await assertFails(del('drvA', 'drivers/drvA/trips/trip1/selfie-1.jpg'));
  await assertFails(up('drvB', 'drivers/drvB/trips/trip1/selfie-1.jpg'));
  await assertFails(up('drvA', 'drivers/drvA/trips/fleetTrip/selfie-1.jpg'));
  // The fleet driver's vendor can review the evidence of its trip.
  await assertSucceeds(read('v1', 'drivers/fdr/trips/fleetTrip/selfie-1.jpg'));
  await assertFails(read('v2', 'drivers/fdr/trips/fleetTrip/selfie-1.jpg'));
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'bookings/trip1'), { status: 'Completed' }));
  await assertFails(up('drvA', 'drivers/drvA/trips/trip1/late-1.jpg'));
  await assertSucceeds(del('ops', 'drivers/drvA/trips/trip1/odometer-1.jpg'));
});

test('uploads: size and type are validated', async () => {
  await assertFails(up('drvA', 'drivers/drvA/kyc/huge.jpg', new Uint8Array(10 * 1024 * 1024 + 1)));
  await assertFails(up('drvA', 'drivers/drvA/kyc/script.js', bytes(), { contentType: 'application/javascript' }));
  await assertSucceeds(up('drvA', 'drivers/drvA/kyc/pan.pdf', bytes(), { contentType: 'application/pdf' }));
});

test('vendor, fleet and customer folders: owners add new files, staff manage by permission', async () => {
  await assertSucceeds(up('v1', 'vendors/v1/onboarding/rc/2_b_rc.pdf', bytes(), { contentType: 'application/pdf' }));
  await assertFails(up('v1', 'vendors/v1/onboarding/rc/1_a_rc.pdf', bytes(), { contentType: 'application/pdf' }));
  await assertFails(del('v1', 'vendors/v1/onboarding/rc/1_a_rc.pdf'));
  await assertFails(up('v2', 'vendors/v1/onboarding/rc/3_c_rc.pdf', bytes(), { contentType: 'application/pdf' }));
  await assertSucceeds(up('vDraft', 'vendors/vDraft/onboarding/id/1_x.pdf', bytes(), { contentType: 'application/pdf' }));
  await assertSucceeds(del('vDraft', 'vendors/vDraft/onboarding/id/1_x.pdf'));
  await assertSucceeds(up('flt', 'fleet/veh1/rc-2.jpg'));
  await assertFails(up('ops', 'fleet/veh1/rc-3.jpg'));
  await assertFails(read('v1', 'fleet/veh1/rc-1.jpg'));
  await assertSucceeds(up('cust1', 'customers/cust1/profile/avatar-1.jpg'));
  await assertFails(up('cust2', 'customers/cust1/profile/avatar-2.jpg'));
  await assertFails(up('cust1', 'somewhere/else.jpg'));
});
