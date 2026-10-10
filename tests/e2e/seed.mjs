// Seeds the local Firebase emulators (project demo-nesam) with a small, realistic
// data set for manual / browser testing, and prints emulator sign-in tokens.
//
//   firebase emulators:start --only auth,firestore,functions,storage --project demo-nesam --config firebase.e2e.json
//   node tests/e2e/seed.mjs            (from the repo root)
//
// Never point this at a real project: it refuses to run unless the emulator
// hosts are set and the project id starts with "demo-".
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../functions/package.json'));
const admin = require('firebase-admin');

process.env.GCLOUD_PROJECT ||= 'demo-nesam';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
if (!process.env.GCLOUD_PROJECT.startsWith('demo-')) throw new Error('Refusing to seed a non-demo project.');

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();
const auth = admin.auth();
const now = admin.firestore.FieldValue.serverTimestamp();

async function user(uid, props) {
  try {
    await auth.deleteUser(uid);
  } catch {
    /* first run */
  }
  await auth.createUser({ uid, ...props });
}

// ── Accounts ────────────────────────────────────────────────────────────────
await user('ops', { email: 'ops@nesam.test', password: 'Test@12345', displayName: 'Ops Desk' });
await db.doc('admins/ops').set({ role: 'admin', status: 'active', name: 'Ops Desk', email: 'ops@nesam.test', createdAt: now });

await user('cust1', { phoneNumber: '+919800000001', displayName: 'Priya Raman' });
await db.doc('customers/cust1').set({
  uid: 'cust1', name: 'Priya Raman', phone: '+91 9800000001', phoneE164: '+919800000001', email: 'priya@example.com', photoUrl: '',
  walletBalance: 0, emergencyContact: '+91 9800000009', language: 'English', role: 'customer', status: 'Approved', createdAt: now,
});
await db.doc('saved_places/cust1_home').set({ ownerId: 'cust1', name: 'Home', address: 'Bodi Road, Theni, Tamil Nadu', type: 'home', lat: 10.0104, lng: 77.4768, createdAt: now });

await user('drvA', { phoneNumber: '+919800000002', displayName: 'Murugan S' });
await db.doc('drivers/drvA').set({
  uid: 'drvA', id: 'drvA', role: 'driver', name: 'Murugan S', phone: '+91 98000 00002', phoneE164: '+919800000002', email: 'murugan@example.com',
  status: 'Approved', docStatus: 'Approved', verified: true, vendorId: '', vendorName: '', presenceStatus: 'Online', vehicleType: 'Sedan',
  city: 'Theni', licenseInfo: { number: 'TN6020190001234', expiryDate: '2030-12-31' },
  vehicleInfo: { vehicleNumber: 'TN60AB1234', vehicleType: 'Sedan', make: 'Maruti', model: 'Dzire', year: '2022', color: 'White', rcNumber: 'TN60AB1234' },
  vehicleNumber: 'TN60AB1234', createdAt: now,
});
await db.doc('driver_private/drvA').set({ bank: { accountHolder: 'Murugan S', accountNumber: '123456789012', ifsc: 'SBIN0001234', bankName: 'SBI', upiId: 'murugan@okaxis' } });

// ── Pricing & policy ────────────────────────────────────────────────────────
await db.doc('business_config/commission').set({ base: 'taxable', global: { rate: 15 }, services: {}, categories: {}, version: 1 });
const fare = (o) => ({ minimumFare: 300, nightAllowance: 150, waitingChargePerHour: 120, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 0, ...o });
const categories = [
  ['sedan', { name: 'Sedan', code: 'SEDAN', seatingCapacity: 4, displayOrder: 1, fare: fare({ baseFare: 300, baseKm: 10, perKmRate: 14, perMinuteRate: 1.5, outstationPerKmRate: 13, outstationDriverBattaPerDay: 400, extraKmCharge: 15 }) }],
  ['suv', { name: 'SUV', code: 'SUV', seatingCapacity: 6, displayOrder: 2, fare: fare({ baseFare: 450, baseKm: 10, perKmRate: 18, perMinuteRate: 2, outstationPerKmRate: 17, outstationDriverBattaPerDay: 500, extraKmCharge: 19, carrierCharge: 150 }) }],
  ['innova', { name: 'Innova Crysta', code: 'INNOVA', seatingCapacity: 7, displayOrder: 3, fare: fare({ baseFare: 600, baseKm: 10, perKmRate: 22, perMinuteRate: 2, outstationPerKmRate: 20, outstationDriverBattaPerDay: 600, extraKmCharge: 22, parkingIncluded: true }) }],
  ['tempo', { name: 'Tempo Traveller', code: 'TEMPO', seatingCapacity: 12, displayOrder: 4, fare: fare({ baseFare: 1200, baseKm: 10, perKmRate: 30, perMinuteRate: 3, outstationPerKmRate: 28, outstationDriverBattaPerDay: 800, extraKmCharge: 30, permitCharge: 500 }) }],
];
for (const [id, c] of categories) await db.doc(`vehicle_categories/${id}`).set({ ...c, status: 'Active', createdAt: now });

// ── Published legal documents (customers and drivers must accept them) ──────
const legal = (type, role, title) => ({
  key: `${type}_${role}`, type, role, title, version: 1, status: 'Published', requiresAcceptance: true,
  body: `${title} for NESAM ${role}s (test copy for the local emulator — not the legal text).`,
  checkboxText: 'I have read and agree to the Terms & Conditions and Privacy Policy.', publishedAt: now,
});
for (const role of ['customer', 'driver']) {
  await db.doc(`legal_documents/terms_${role}`).set(legal('terms', role, 'Terms & Conditions'));
  await db.doc(`legal_documents/privacy_${role}`).set(legal('privacy', role, 'Privacy Policy'));
}

// ── Sign-in tokens for the browser tests (emulator only) ────────────────────
const tokens = {};
for (const uid of ['ops', 'cust1', 'drvA']) tokens[uid] = await auth.createCustomToken(uid);
writeFileSync(join(here, '.tokens.json'), JSON.stringify(tokens, null, 2));
console.log('Seeded demo-nesam. Tokens written to tests/e2e/.tokens.json');
process.exit(0);
