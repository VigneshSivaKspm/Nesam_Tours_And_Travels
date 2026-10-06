// Admin panel services (admin/src/services/*.ts) run unmodified against the
// Firestore emulator with the real firestore.rules, signed in as an active
// admin. The TypeScript is transpiled on the fly with the admin's compiler;
// only the Firebase app wiring (services/firebase.ts) is replaced.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as firestore from 'firebase/firestore';

const requireAdmin = createRequire(new URL('../../admin/package.json', import.meta.url));
const ts = requireAdmin('typescript');

/** Loads an admin TS module; relative imports resolve through `modules`. */
function loadAdminModule(relPath, modules) {
  const source = readFileSync(new URL(`../../admin/src/${relPath}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  const req = (name) => {
    if (name in modules) return modules[name];
    if (name === 'firebase/firestore') return firestore;
    throw new Error(`Unexpected import ${name} from ${relPath}`);
  };
  new Function('require', 'exports', outputText)(req, exports);
  return exports;
}

let env;
const as = {};
const services = {};
const TODAY = new Date();
const iso = (days) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Service modules bound to one signed-in context's Firestore instance. */
function servicesFor(db) {
  const firebaseShim = { db, storage: {}, auth: {}, app: {} };
  const adminFirestoreService = loadAdminModule('services/adminFirestoreService.ts', {
    './firebase': firebaseShim,
    './adminNotificationService': {},
  });
  const vehicleService = loadAdminModule('services/vehicleService.ts', {
    './firebase': firebaseShim,
    './adminFirestoreService': adminFirestoreService,
    'firebase/storage': {},
  });
  const categoryService = loadAdminModule('services/categoryService.ts', {
    './firebase': firebaseShim,
    './adminFirestoreService': adminFirestoreService,
  });
  const analytics = loadAdminModule('utils/analytics.ts', {});
  const paymentService = loadAdminModule('services/paymentService.ts', {
    './firebase': firebaseShim,
    './adminFirestoreService': adminFirestoreService,
    './paymentReconciliation': loadAdminModule('services/paymentReconciliation.ts', {}),
    '../utils/analytics': analytics,
  });
  const invoiceService = loadAdminModule('services/invoiceService.ts', {
    './firebase': firebaseShim,
    './adminFirestoreService': adminFirestoreService,
    '../utils/analytics': analytics,
  });
  const earningsService = loadAdminModule('services/earningsService.ts', {
    './firebase': firebaseShim,
    './adminFirestoreService': adminFirestoreService,
    './paymentService': paymentService,
    '../utils/analytics': analytics,
  });
  const penaltyService = loadAdminModule('services/penaltyService.ts', {
    './firebase': firebaseShim,
    './adminFirestoreService': adminFirestoreService,
    './paymentService': paymentService,
    '../utils/analytics': analytics,
  });
  const serviceMasterService = loadAdminModule('services/serviceMasterService.ts', {
    './firebase': firebaseShim,
    './adminFirestoreService': adminFirestoreService,
  });
  const tourPackageService = loadAdminModule('services/tourPackageService.ts', {
    './firebase': firebaseShim,
    './adminFirestoreService': adminFirestoreService,
  });
  const locationService = loadAdminModule('services/locationService.ts', {
    './firebase': firebaseShim,
    './adminFirestoreService': adminFirestoreService,
  });
  const fareRuleService = loadAdminModule('services/fareRuleService.ts', {
    './firebase': firebaseShim,
    './adminFirestoreService': adminFirestoreService,
  });
  return { adminFirestoreService, vehicleService, categoryService, analytics, paymentService, invoiceService, earningsService, penaltyService, serviceMasterService, tourPackageService, locationService, fareRuleService };
}

/** Loads the Cloud Functions fare policy (functions/src/domain/pricing.ts) the same way. */
function loadServerPricing() {
  const source = readFileSync(new URL('../../functions/src/domain/pricing.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = {};
  new Function('require', 'exports', outputText)((name) => {
    if (name === './types') return {};
    throw new Error(`Unexpected import ${name} from pricing.ts`);
  }, exports);
  return exports;
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'nesam-rules-admin',
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8089),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const put = (path, data) => firestore.setDoc(firestore.doc(db, path), data);
    await put('admins/admin1', { role: 'admin', status: 'active', name: 'Ops Admin' });
    await put('admins/former', { role: 'admin', status: 'inactive' });
    await put('vendors/v1', { uid: 'v1', role: 'vendor', status: 'APPROVED', companyName: 'Sri Balaji Travels' });
    await put('drivers/fd1', { role: 'driver', status: 'Approved', vendorId: 'v1', name: 'Kumar', phone: '+919800000101' });
    await put('drivers/fd2', { role: 'driver', status: 'Approved', vendorId: 'v1', name: 'Ravi', phone: '+919800000102' });
    await put('drivers/ind1', { role: 'driver', status: 'Approved', vendorId: '', name: 'Selvam', phone: '+919800000103' });
    await put('drivers/pend1', { role: 'driver', status: 'Pending', vendorId: 'v1', name: 'New', phone: '+919800000104' });
    await put('vehicle_categories/sedan', { name: 'Sedan', code: 'SEDAN', seatingCapacity: 4, status: 'Active' });
    // A prototype-era document with the legacy field names.
    await put('vehicles/legacy1', { number: 'TN09 ZZ 9999', category: 'Sedan', seats: 4, fuel: 'Diesel', status: 'Available', rate: '₹12/km', driver: 'Someone' });
  });
  as.admin = env.authenticatedContext('admin1').firestore();
  as.former = env.authenticatedContext('former').firestore();
  as.vendor = env.authenticatedContext('v1', { phone_number: '+919800000001' }).firestore();
  services.admin = servicesFor(as.admin);
});

after(async () => {
  await env?.cleanup();
});

async function readAll(db, path) {
  const snap = await firestore.getDocs(firestore.collection(db, path));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

async function state() {
  const db = as.admin;
  const { vehicleService } = services.admin;
  return {
    vehicles: (await readAll(db, 'vehicles')).map(vehicleService.mapVehicle),
    drivers: await readAll(db, 'drivers'),
    bookings: await readAll(db, 'bookings'),
  };
}

const baseInput = (over = {}) => ({
  vehicleNumber: 'tn 01 ab 1234',
  vendorId: 'v1',
  vendorName: 'Sri Balaji Travels',
  categoryId: 'sedan',
  category: 'Sedan',
  make: 'Toyota',
  model: 'Etios',
  year: '2022',
  seatingCapacity: 4,
  fuelType: 'Diesel',
  status: 'Active',
  assignedDriverId: '',
  rcNumber: 'rc123',
  rcDocUrl: '',
  insuranceExpiry: '',
  insuranceDocUrl: '',
  fitnessExpiry: '',
  fitnessDocUrl: '',
  permitExpiry: '',
  statePermitDocUrl: '',
  ...over,
});

test('vehicles: registration number validation and normalised duplicate check', async () => {
  const { vehicleService: vs } = services.admin;
  assert.equal(vs.validateRegNumber('TN 01 AB 1234'), '');
  assert.equal(vs.validateRegNumber('22 BH 1234 AA'), '');
  assert.ok(vs.validateRegNumber('HELLO'));
  assert.ok(vs.validateRegNumber(''));
  const { vehicles } = await state();
  const errs = vs.validateVehicleInput(baseInput({ vehicleNumber: 'tn09-zz-9999' }), { vehicles, editingId: null });
  assert.match(errs.vehicleNumber, /already registered/);
  const bad = vs.validateVehicleInput(baseInput({ year: '1980', seatingCapacity: 1, fuelType: 'Steam', make: ' ', insuranceExpiry: '2026-13-45' }), { vehicles, editingId: null });
  assert.ok(bad.year && bad.seatingCapacity && bad.fuelType && bad.make && bad.insuranceExpiry);
  assert.deepEqual(vs.validateVehicleInput(baseInput(), { vehicles, editingId: null }), {});
});

test('vehicles: legacy documents are read with canonical fields', async () => {
  const { vehicles } = await state();
  const legacy = vehicles.find((v) => v.id === 'legacy1');
  assert.equal(legacy.vehicleNumber, 'TN09 ZZ 9999');
  assert.equal(legacy.seatingCapacity, 4);
  assert.equal(legacy.fuelType, 'Diesel');
  assert.equal(legacy.status, 'Active');
  assert.equal(legacy.docStatus, 'Pending');
});

test('vehicles: admin registers a vendor vehicle with a paired driver (both documents updated)', async () => {
  const { vehicleService: vs } = services.admin;
  const s = await state();
  await vs.saveVehicle({ id: 'adm1', input: baseInput({ assignedDriverId: 'fd1' }), existing: null, ...s });
  const v = (await firestore.getDoc(firestore.doc(as.admin, 'vehicles/adm1'))).data();
  assert.equal(v.vehicleNumber, 'TN 01 AB 1234');
  assert.equal(v.docStatus, 'Pending');
  assert.equal(v.vendorId, 'v1');
  assert.equal(v.assignedDriverName, 'Kumar');
  assert.ok(v.createdAt);
  const d = (await firestore.getDoc(firestore.doc(as.admin, 'drivers/fd1'))).data();
  assert.equal(d.assignedVehicleId, 'adm1');
  assert.equal(d.assignedVehicleNumber, 'TN 01 AB 1234');
});

test('vehicles: only approved drivers of the same owner can be paired', async () => {
  const { vehicleService: vs } = services.admin;
  const s = await state();
  assert.deepEqual(vs.eligibleDrivers('v1', s.drivers).map((d) => d.id).sort(), ['fd1', 'fd2']);
  assert.deepEqual(vs.eligibleDrivers('', s.drivers).map((d) => d.id), ['ind1']);
  await assert.rejects(
    vs.saveVehicle({ id: 'adm2', input: baseInput({ vehicleNumber: 'TN 02 CD 5678', assignedDriverId: 'ind1' }), existing: null, ...s }),
    /not an approved driver/,
  );
  await assert.rejects(
    vs.saveVehicle({ id: 'adm2', input: baseInput({ vehicleNumber: 'TN 02 CD 5678', assignedDriverId: 'pend1' }), existing: null, ...s }),
    /not an approved driver/,
  );
});

test('vehicles: moving a driver releases the previous vehicle; editing clears legacy fields', async () => {
  const { vehicleService: vs } = services.admin;
  let s = await state();
  await vs.saveVehicle({ id: 'adm3', input: baseInput({ vehicleNumber: 'TN 03 EF 1111', assignedDriverId: 'fd1' }), existing: null, ...s });
  const old = (await firestore.getDoc(firestore.doc(as.admin, 'vehicles/adm1'))).data();
  assert.equal(old.assignedDriverId, '');
  assert.equal(((await firestore.getDoc(firestore.doc(as.admin, 'drivers/fd1'))).data()).assignedVehicleId, 'adm3');

  s = await state();
  const legacy = s.vehicles.find((v) => v.id === 'legacy1');
  await vs.saveVehicle({
    id: 'legacy1',
    input: baseInput({ vehicleNumber: legacy.vehicleNumber, vendorId: '', vendorName: '', assignedDriverId: 'ind1' }),
    existing: legacy,
    ...s,
  });
  const updated = (await firestore.getDoc(firestore.doc(as.admin, 'vehicles/legacy1'))).data();
  for (const f of ['number', 'seats', 'fuel', 'rate', 'driver']) assert.equal(f in updated, false, `${f} removed`);
  assert.equal(updated.seatingCapacity, 4);
  assert.equal(updated.assignedDriverName, 'Selvam');
});

test('vehicles: documents are approved only when RC, insurance and permit are valid', async () => {
  const { vehicleService: vs } = services.admin;
  let s = await state();
  const v = s.vehicles.find((x) => x.id === 'adm1');
  await assert.rejects(vs.reviewVehicleDocuments(v, 'Approved', ''), /Cannot approve yet/);
  await assert.rejects(vs.reviewVehicleDocuments(v, 'Rejected', '  '), /reason/);

  await vs.saveVehicle({
    id: 'adm1',
    input: baseInput({ rcDocUrl: 'https://files/rc.pdf', insuranceExpiry: iso(10), insuranceDocUrl: 'https://files/ins.pdf', permitExpiry: iso(200), statePermitDocUrl: 'https://files/permit.pdf' }),
    existing: v,
    ...s,
  });
  s = await state();
  const ready = s.vehicles.find((x) => x.id === 'adm1');
  const states = Object.fromEntries(vs.vehicleDocuments(ready, TODAY).map((d) => [d.key, d.state]));
  assert.deepEqual(states, { rc: 'Valid', insurance: 'Expiring', permit: 'Valid', fitness: 'Missing' });
  await vs.reviewVehicleDocuments(ready, 'Approved', '');
  assert.equal(((await firestore.getDoc(firestore.doc(as.admin, 'vehicles/adm1'))).data()).docStatus, 'Approved');

  const expired = { ...ready, permitExpiry: iso(0) };
  assert.equal(vs.documentState(expired.statePermitDocUrl, expired.permitExpiry, TODAY), 'Expired');
  assert.ok(vs.approvalBlockers(expired, TODAY).some((b) => /permit.*expired/i.test(b)));
});

test('vehicles: availability follows live bookings and trips lock the vehicle', async () => {
  const { vehicleService: vs } = services.admin;
  await env.withSecurityRulesDisabled((c) =>
    firestore.setDoc(firestore.doc(c.firestore(), 'bookings/trip1'), { bookingId: 'NT-1', status: 'Ongoing', assignedVehicleNumber: 'TN01AB1234', assignedDriverId: 'fd2', pickup: 'A', drop: 'B' }),
  );
  const s = await state();
  const v = s.vehicles.find((x) => x.id === 'adm1');
  assert.equal(vs.availabilityOf(v, s.bookings), 'On Trip');
  await assert.rejects(vs.setVehicleStatus(v, 'Maintenance', s.bookings), /on trip NT-1/);
  await assert.rejects(vs.deleteVehicle(v, s.bookings), /on trip NT-1/);
  await assert.rejects(vs.saveVehicle({ id: 'adm1', input: baseInput({ status: 'Inactive', rcDocUrl: v.rcDocUrl }), existing: v, ...s }), /after the trip ends/);
  const other = s.vehicles.find((x) => x.id === 'adm3');
  assert.equal(vs.availabilityOf(other, s.bookings), 'Awaiting Approval');
});

test('vehicles: delete needs no driver pairing and no active trip', async () => {
  const { vehicleService: vs } = services.admin;
  let s = await state();
  const paired = s.vehicles.find((x) => x.id === 'adm3');
  await assert.rejects(vs.deleteVehicle(paired, s.bookings), /Unassign Kumar/);
  await vs.saveVehicle({ id: 'adm3', input: baseInput({ vehicleNumber: paired.vehicleNumber }), existing: paired, ...s });
  assert.equal(((await firestore.getDoc(firestore.doc(as.admin, 'drivers/fd1'))).data()).assignedVehicleId, '');
  s = await state();
  await vs.deleteVehicle(s.vehicles.find((x) => x.id === 'adm3'), s.bookings);
  assert.equal((await firestore.getDoc(firestore.doc(as.admin, 'vehicles/adm3'))).exists(), false);
});

test('vehicles: admin-registered vendor vehicles stay compatible with the vendor app', async () => {
  // The vendor can read and update its vehicle (docStatus must go back to Pending).
  await assertSucceeds(firestore.getDoc(firestore.doc(as.vendor, 'vehicles/adm1')));
  await assertSucceeds(firestore.updateDoc(firestore.doc(as.vendor, 'vehicles/adm1'), { insuranceExpiry: iso(300), docStatus: 'Pending', updatedAt: firestore.serverTimestamp() }));
  await assertFails(firestore.updateDoc(firestore.doc(as.vendor, 'vehicles/adm1'), { docStatus: 'Approved' }));
});

test('vehicles: an inactive admin cannot write fleet records', async () => {
  const former = servicesFor(as.former).vehicleService;
  const s = await state();
  await assert.rejects(
    former.saveVehicle({ id: 'adm9', input: baseInput({ vehicleNumber: 'TN 09 AA 0001' }), existing: null, ...s }),
    /permission/,
  );
  await assertFails(firestore.setDoc(firestore.doc(as.former, 'vehicles/x'), { vehicleNumber: 'X' }));
});

// ── Vehicle categories ──────────────────────────────────────────────────────

const categoryForm = (over = {}) => ({
  name: 'Premium SUV',
  code: '',
  description: '',
  imageUrl: '',
  icon: '🚙',
  seatingCapacity: 6,
  luggageCapacity: '3 bags',
  acSupported: 'AC',
  recommendedPassengers: 0,
  displayOrder: 3,
  status: 'Active',
  fare: {
    baseFare: 400, baseKm: 8, perKmRate: 18, minimumFare: 400, driverAllowance: 0, nightAllowance: 150,
    waitingChargePerHour: 120, extraHourCharge: 0, extraKmCharge: 0, tollIncluded: false, parkingIncluded: false,
    permitCharge: 0, outstationPerKmRate: 20, outstationDriverBattaPerDay: 400, outstationMinKmPerDay: 250,
  },
  ...over,
});

const readCategories = async () => readAll(as.admin, 'vehicle_categories');

test('categories: validation — required per-km rate, duplicates, ranges', async () => {
  const { categoryService: cs } = services.admin;
  const cats = await readCategories();
  assert.deepEqual(cs.validateCategory(categoryForm(), cats, null), {});
  const noRate = cs.validateCategory(categoryForm({ fare: { ...categoryForm().fare, perKmRate: 0 } }), cats, null);
  assert.match(noRate['fare.perKmRate'], /cannot book/);
  const dup = cs.validateCategory(categoryForm({ name: ' sedan ' }), cats, null);
  assert.match(dup.name, /already exists/);
  assert.match(dup.code, /already used/);
  const bad = cs.validateCategory(categoryForm({ seatingCapacity: 0, displayOrder: 0, imageUrl: 'ftp://x', recommendedPassengers: 9, fare: { ...categoryForm().fare, baseFare: -1, minimumFare: 100 } }), cats, null);
  assert.ok(bad.seatingCapacity && bad.displayOrder && bad.imageUrl && bad['fare.baseFare']);
  assert.equal(cs.deriveCategoryCode('Innova  Crysta!'), 'INNOVA_CRYSTA');
});

test('categories: create uses an auto id with timestamps; codes cannot collide', async () => {
  const { categoryService: cs } = services.admin;
  const a = await cs.saveCategory(categoryForm({ name: 'Tempo Traveller 12 Seater' }), null);
  const b = await cs.saveCategory(categoryForm({ name: 'Tempo Traveller 17 Seater' }), null);
  assert.notEqual(a.id, b.id);
  const doc = (await firestore.getDoc(firestore.doc(as.admin, `vehicle_categories/${a.id}`))).data();
  assert.equal(doc.code, 'TEMPO_TRAVELLER_12_SEATER');
  assert.equal(doc.recommendedPassengers, 6);
  assert.ok(doc.createdAt && doc.updatedAt);
});

test('categories: rename propagates to vehicles, fare rules, services, packages and coupons', async () => {
  const { categoryService: cs } = services.admin;
  const { id } = await cs.saveCategory(categoryForm({ name: 'Crysta' }), null);
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const put = (p, d) => firestore.setDoc(firestore.doc(db, p), d);
    await put('vehicles/cv1', { vehicleNumber: 'TN 05 AA 0001', categoryId: id, category: 'Crysta' });
    await put('vehicles/cv2', { vehicleNumber: 'TN 05 AA 0002', category: 'Crysta' }); // legacy, name only
    await put('fare_rules/cr1', { vehicleCategoryId: id, vehicleCategoryName: 'Crysta' });
    await put('services/cs1', { allowedVehicleCategoryIds: [id, 'sedan'], allowedVehicleCategoryNames: ['Crysta', 'Sedan'] });
    await put('tour_packages/cp1', { allowedVehicleCategoryIds: [id], allowedVehicleCategoryNames: ['Crysta'] });
    await put('coupons/cc1', { vehicleCategoryIds: [id], vehicleCategoryNames: ['Crysta'] });
  });
  const existing = (await readCategories()).find((c) => c.id === id);
  const { renamed } = await cs.saveCategory(categoryForm({ name: 'Innova Crysta' }), existing);
  assert.equal(renamed, 6);
  const get = async (p) => (await firestore.getDoc(firestore.doc(as.admin, p))).data();
  assert.equal((await get('vehicles/cv1')).category, 'Innova Crysta');
  assert.equal((await get('vehicles/cv2')).categoryId, id);
  assert.equal((await get('fare_rules/cr1')).vehicleCategoryName, 'Innova Crysta');
  assert.deepEqual((await get('services/cs1')).allowedVehicleCategoryNames, ['Innova Crysta', 'Sedan']);
  assert.deepEqual((await get('tour_packages/cp1')).allowedVehicleCategoryNames, ['Innova Crysta']);
  assert.deepEqual((await get('coupons/cc1')).vehicleCategoryNames, ['Innova Crysta']);
});

test('categories: delete is blocked while anything uses the category', async () => {
  const { categoryService: cs, vehicleService: vs } = services.admin;
  const cats = await readCategories();
  const crysta = cats.find((c) => c.name === 'Innova Crysta');
  const fleet = (await readAll(as.admin, 'vehicles')).map(vs.mapVehicle);
  const refs = await cs.findCategoryReferences(crysta, fleet);
  assert.deepEqual(refs, { vehicles: 2, fareRules: 1, services: 1, tourPackages: 1, coupons: 1 });
  await assert.rejects(cs.deleteCategory(crysta, fleet), /used by 2 vehicles, 1 fare rule, 1 service, 1 tour package, 1 coupon/);
  const unused = cats.find((c) => c.name === 'Tempo Traveller 17 Seater');
  await cs.deleteCategory(unused, fleet);
  assert.equal((await firestore.getDoc(firestore.doc(as.admin, `vehicle_categories/${unused.id}`))).exists(), false);
});

test('categories: status toggle changes only the status; activation needs a per-km rate', async () => {
  const { categoryService: cs } = services.admin;
  const cat = (await readCategories()).find((c) => c.name === 'Innova Crysta');
  await cs.setCategoryStatus(cat, 'Inactive');
  const after = (await firestore.getDoc(firestore.doc(as.admin, `vehicle_categories/${cat.id}`))).data();
  assert.equal(after.status, 'Inactive');
  assert.equal(after.fare.perKmRate, 18);
  await assert.rejects(cs.setCategoryStatus({ ...cat, fare: { perKmRate: 0 } }, 'Active'), /per-km rate/);
  await assertFails(firestore.updateDoc(firestore.doc(as.vendor, `vehicle_categories/${cat.id}`), { status: 'Active' }));
});
// ── Payments ────────────────────────────────────────────────────────────────

async function seedBooking(id, data) {
  await env.withSecurityRulesDisabled((c) =>
    firestore.setDoc(firestore.doc(c.firestore(), `bookings/${id}`), {
      bookingId: `NT-${id}`, customerId: 'cust9', customer: 'Anita', pickup: 'A', drop: 'B', fare: 1200,
      fareVerified: true, payment: 'Pending', status: 'Completed', ...data,
    }),
  );
  return { id, bookingId: `NT-${id}`, fare: 1200, status: 'Completed', payment: 'Pending', ...data };
}
const readDoc = async (p) => (await firestore.getDoc(firestore.doc(as.admin, p))).data();

test('payments: cash collection is confirmed once, with fare + tolls, and audited', async () => {
  const { paymentService: ps } = services.admin;
  const b = await seedBooking('cash1', { paymentMethod: 'Cash', tollCharges: 150 });
  await ps.confirmCashCollection(b, '', 'admin1');
  const pay = await readDoc('payments/booking_cash1');
  assert.equal(pay.amount, 1350);
  assert.equal(pay.method, 'Cash');
  assert.equal(pay.bookingId, 'NT-cash1');
  assert.equal(pay.verifiedBy, 'admin1');
  assert.equal((await readDoc('bookings/cash1')).payment, 'Paid');
  assert.equal((await readDoc('bookings/cash1/events/payment_cash1')).type, 'cash_collection_confirmed');
  await assert.rejects(ps.confirmCashCollection(b, '', 'admin1'), /already recorded/);
});

test('payments: cash confirmation refuses UPI, unfinished and missing bookings', async () => {
  const { paymentService: ps } = services.admin;
  const upi = await seedBooking('upi1', { paymentMethod: 'UPI' });
  await assert.rejects(ps.confirmCashCollection(upi, '', 'admin1'), /not a cash booking/);
  const ongoing = await seedBooking('cash2', { paymentMethod: 'Cash', status: 'Ongoing' });
  await assert.rejects(ps.confirmCashCollection(ongoing, '', 'admin1'), /Only completed trips/);
  await assert.rejects(ps.confirmCashCollection({ id: 'nope' }, '', 'admin1'), /no longer exists/);
  await assert.rejects(ps.confirmCashCollection(ongoing, '', ''), /session/);
});

test('payments: UPI verification reuses reconciliation and blocks double recording', async () => {
  const { paymentService: ps } = services.admin;
  const b = await seedBooking('upi2', { paymentMethod: 'UPI' });
  await assert.rejects(ps.verifyOnlinePayment(b, '1000', 'UTR1', false, 'admin1'), /Expected received amount: ₹1200/);
  await ps.verifyOnlinePayment(b, '1200', 'UTR123456', false, 'admin1');
  assert.equal((await readDoc('payments/booking_upi2')).reference, 'UTR123456');
  await assert.rejects(ps.verifyOnlinePayment(b, '1200', 'UTR123456', false, 'admin1'), /already reconciled/);
  const cash = await seedBooking('cash3', { paymentMethod: 'Cash' });
  await assert.rejects(ps.verifyOnlinePayment(cash, '1200', 'X', false, 'admin1'), /Cash collected/);
});

test('payments: awaiting queue, legacy records and non-admin writes', async () => {
  const { paymentService: ps } = services.admin;
  const bookings = [
    { id: 'a', status: 'Completed', payment: 'Pending', fare: 500 },
    { id: 'b', status: 'Completed', payment: 'Paid', fare: 500 },
    { id: 'c', status: 'Ongoing', payment: 'Pending', fare: 500 },
  ];
  assert.deepEqual(ps.bookingsAwaitingPayment(bookings).map((x) => x.id), ['a']);
  assert.equal(ps.expectedAmount({ fare: '₹1,250', tollCharges: 50 }), 1300);
  const legacy = ps.mapPayment({ id: 'TXN-1', bookingId: 'NTT-1', customer: 'X', amount: '₹1,500', method: 'UPI', date: '24 Aug 2024', status: 'Success' });
  assert.equal(legacy.amount, 1500);
  assert.equal(legacy.date.getFullYear(), 2024);
  assert.equal(ps.isSuccessfulPayment('Success'), true);
  await assertFails(firestore.setDoc(firestore.doc(as.vendor, 'payments/booking_x'), { amount: 1 }));
  await assertFails(firestore.setDoc(firestore.doc(as.former, 'payments/booking_x'), { amount: 1 }));
});
// ── Invoices ────────────────────────────────────────────────────────────────

const COMPANY = { name: 'NESAM Tours & Travels', gstin: '33ABCDE1234F1Z5', address: 'Theni, Tamil Nadu', phone: '', email: '', sacCode: '9964' };
const NO_BILLING = { name: '', gstin: '', address: '', email: '' };
const serverBreakdown = { baseFare: 100, distanceFare: 800, timeFare: 50, nightCharge: 0, driverAllowance: 0, minimumFareAdjustment: 0, subtotal: 950, discount: 50, taxableAmount: 900, gstRate: 0.05, gst: 45, total: 945 };

test('invoices: lines use the server fare breakdown exactly; tolls are non-taxable', async () => {
  const { invoiceService: is } = services.admin;
  const l = is.buildInvoiceLines({ id: 'x', fare: 945, fareBreakdown: serverBreakdown, tollCharges: 120, service: 'Local', pickup: 'A', drop: 'B' });
  assert.equal(l.taxableAmount, 900);
  assert.equal(l.totalTax, 45);
  assert.equal(l.cgst + l.sgst, 45);
  assert.equal(l.discount, 50);
  assert.equal(l.subtotal, 950);
  assert.equal(l.grandTotal, 1065);
  assert.deepEqual(l.items.map((i) => i.amount), [100, 800, 50, 120]);
  assert.equal(l.items[3].sacCode, undefined);
  const legacy = is.buildInvoiceLines({ id: 'y', fare: '₹1,050' });
  assert.equal(legacy.totalTax, 50);
  assert.equal(legacy.taxableAmount, 1000);
  assert.equal(legacy.items.length, 1);
  assert.equal(is.amountInWords(1065), 'Rupees One Thousand and Sixty Five Only');
  assert.equal(is.amountInWords(1250000.5), 'Rupees Twelve Lakh Fifty Thousand and Fifty Paise Only');
});

test('invoices: company details are required and validated', async () => {
  const { invoiceService: is } = services.admin;
  assert.deepEqual(is.companyProblems(is.companyFromSettings({})), ['company name', 'a valid GSTIN', 'registered address']);
  assert.deepEqual(is.companyProblems(COMPANY), []);
  const b = await seedBooking('inv0', { paymentMethod: 'UPI' });
  await assert.rejects(is.createInvoice({ booking: b, company: { ...COMPANY, gstin: '33AABCN1234' }, billing: NO_BILLING, actorId: 'admin1' }), /valid GSTIN/);
  await assert.rejects(is.createInvoice({ booking: b, company: COMPANY, billing: { ...NO_BILLING, gstin: 'BAD' }, actorId: 'admin1' }), /Customer GSTIN/);
});

test('invoices: sequential numbers, one active invoice per trip, completed trips only', async () => {
  const { invoiceService: is } = services.admin;
  const year = new Date().getFullYear();
  const b1 = await seedBooking('inv1', { paymentMethod: 'UPI', fare: 945, fareBreakdown: serverBreakdown });
  const b2 = await seedBooking('inv2', { paymentMethod: 'Cash', payment: 'Paid' });
  const r1 = await is.createInvoice({ booking: b1, company: COMPANY, billing: NO_BILLING, actorId: 'admin1' });
  const r2 = await is.createInvoice({ booking: b2, company: COMPANY, billing: { ...NO_BILLING, gstin: '29ABCDE1234F1Z5', name: 'Acme Pvt Ltd' }, actorId: 'admin1' });
  assert.equal(r1.invoiceNumber, `NES-INV-${year}-00001`);
  assert.equal(r2.invoiceNumber, `NES-INV-${year}-00002`);
  const inv1 = await readDoc(`invoices/${r1.id}`);
  assert.equal(inv1.customerId, 'cust9');
  assert.equal(inv1.bookingDocumentId, 'inv1');
  assert.equal(inv1.paymentStatus, 'Pending');
  assert.equal(inv1.grandTotal, 945);
  const inv2 = await readDoc(`invoices/${r2.id}`);
  assert.equal(inv2.paymentStatus, 'Paid');
  assert.equal(inv2.customerSnapshot.gstin, '29ABCDE1234F1Z5');
  assert.equal(inv2.customerSnapshot.name, 'Acme Pvt Ltd');
  assert.equal((await readDoc('bookings/inv1')).invoiceNumber, r1.invoiceNumber);
  await assert.rejects(is.createInvoice({ booking: b1, company: COMPANY, billing: NO_BILLING, actorId: 'admin1' }), /already exists/);
  const pending = await seedBooking('inv3', { status: 'Assigned' });
  await assert.rejects(is.createInvoice({ booking: pending, company: COMPANY, billing: NO_BILLING, actorId: 'admin1' }), /Only completed trips/);
  assert.match(is.invoiceBlocker(pending, []), /Only completed/);
  // The customer can read their own invoice (rules match on customerId).
  const customer = env.authenticatedContext('cust9').firestore();
  await assertSucceeds(firestore.getDoc(firestore.doc(customer, `invoices/${r1.id}`)));
  await assertFails(firestore.getDoc(firestore.doc(as.vendor, `invoices/${r1.id}`)));
});

test('invoices: void keeps the record, frees the trip, and re-issue gets a new number', async () => {
  const { invoiceService: is } = services.admin;
  const invs = (await readAll(as.admin, 'invoices')).filter((i) => i.bookingDocumentId === 'inv1');
  const active = invs.find((i) => i.invoiceStatus === 'Issued');
  await assert.rejects(is.voidInvoice(active, ' ', 'admin1'), /reason/);
  await is.voidInvoice(active, 'Billing name correction', 'admin1');
  const voided = await readDoc(`invoices/${active.id}`);
  assert.equal(voided.invoiceStatus, 'Cancelled');
  assert.equal(voided.voidReason, 'Billing name correction');
  assert.equal((await readDoc('bookings/inv1')).invoiceId, '');
  await assert.rejects(is.voidInvoice(active, 'again', 'admin1'), /already void/);
  const b1 = { id: 'inv1', status: 'Completed', fare: 945 };
  const again = await is.createInvoice({ booking: b1, company: COMPANY, billing: NO_BILLING, actorId: 'admin1' });
  assert.equal(again.invoiceNumber, `NES-INV-${new Date().getFullYear()}-00003`);
  assert.equal(is.livePaymentStatus({ paymentStatus: 'Pending' }, { payment: 'Paid' }), 'Paid');
});
// ── Driver earnings & payouts ───────────────────────────────────────────────

const trip = (id, over) => ({
  id, bookingId: `NT-${id}`, status: 'Completed', fare: 1000, fareVerified: true, payment: 'Paid', paymentMethod: 'UPI',
  assignedDriverId: 'ind1', driverPayout: 850, completedAt: new Date(), ...over,
});

test('earnings: admin views read the server ledger and wallets — they never compute a payout or balance', async () => {
  const { earningsService: es } = services.admin;
  const now = new Date();
  const old = new Date(Date.now() - 90 * 86400000);
  const fin = (partnerType, partnerId, partnerPayout) => ({ schema: 1, partnerType, partnerId, partnerPayout });
  const bookings = [
    trip('e1', { finance: fin('driver', 'ind1', 850) }),
    trip('e2', { paymentMethod: 'Cash', finance: fin('driver', 'ind1', 850) }),
    trip('e3', {}), // completed, finance not finalized yet
    trip('e4', { assignedVendorId: 'v1', vendorPayout: 900, finance: fin('vendor', 'v1', 900) }), // fleet trip the driver drove
    trip('e5', { status: 'Ongoing' }),
  ];
  const entry = (id, over) => ({
    id, actorType: 'driver', actorId: 'ind1', walletId: 'driver_ind1', type: 'trip_earning', direction: 'credit', netAmount: 850,
    grossAmount: 1000, commissionAmount: 102, status: 'available', bookingId: '', bookingCode: '', payoutRequestId: '', createdAt: now, ...over,
  });
  const ledger = [
    entry('trip_e1', { bookingId: 'e1' }),
    entry('toll_e1', { type: 'toll_reimbursement', netAmount: 100, grossAmount: 100, commissionAmount: 0, bookingId: 'e1' }),
    entry('trip_e2', { bookingId: 'e2', status: 'pending' }),
    entry('cash_e2', { type: 'cash_collected', direction: 'debit', netAmount: 1000, grossAmount: 1000, commissionAmount: 0, status: 'completed', bookingId: 'e2' }),
    entry('trip_old', { bookingId: 'old', createdAt: old }),
    entry('trip_gone', { bookingId: 'gone', status: 'cancelled' }),
    entry('payout_p1', { type: 'payout', direction: 'debit', netAmount: 500, grossAmount: 500, commissionAmount: 0, status: 'completed', payoutRequestId: 'p1' }),
    entry('trip_e4', { actorType: 'vendor', actorId: 'v1', walletId: 'vendor_v1', netAmount: 900, bookingId: 'e4' }),
  ];
  // Balances deliberately differ from anything derivable here: the page must show the server wallet.
  const wallet = { id: 'driver_ind1', available: 123, pending: 850, reserved: 200, paidOut: 500, cashCollected: 1000, tripEarnings: 2550, tollReimbursements: 100, updatedAt: now };

  const all = es.summarizePartner('driver', 'ind1', bookings, ledger, wallet);
  assert.deepEqual(
    [all.completedTrips, all.awaitingFinance, all.earningTrips, all.earnings, all.grossFares, all.platformShare, all.tolls, all.cashTrips, all.cashCollected],
    [4, 1, 3, 2550, 3000, 306, 100, 1, 1000],
  );
  assert.deepEqual([all.available, all.pending, all.reserved, all.paidOut], [123, 850, 200, 500]);
  const recent = es.summarizePartner('driver', 'ind1', bookings, ledger, wallet, { from: new Date(Date.now() - 30 * 86400000), to: null });
  assert.deepEqual([recent.earningTrips, recent.earnings], [2, 1700]);
  assert.equal(recent.available, 123, 'balances are always the all-time wallet');
  const vendor = es.summarizePartner('vendor', 'v1', bookings, ledger, undefined);
  assert.deepEqual([vendor.earnings, vendor.completedTrips, vendor.available], [900, 1, 0]);
  // A driver with no wallet document yet shows zero — never an estimate.
  assert.equal(es.summarizePartner('driver', 'nobody', bookings, ledger, undefined).available, 0);

  assert.equal(es.tripPayout(bookings[0]), 850);
  assert.equal(es.tripPayout(bookings[2]), null);
  assert.deepEqual(es.tripPartner(bookings[3]), { role: 'vendor', id: 'v1' });
  assert.equal(es.tripEarningStatus(ledger, 'e2'), 'pending');
  assert.equal(es.tripEarningStatus(ledger, 'e3'), '');

  const months = es.monthlyFromLedger('driver', ledger, [{ id: 'p1', driverId: 'ind1', amount: 500, status: 'Paid', processedAt: now.toISOString() }]);
  const current = months.find((m) => m.sort === now.getFullYear() * 12 + now.getMonth());
  assert.deepEqual([current.trips, current.gross, current.earnings, current.paid], [2, 2000, 1800, 500]);
  assert.equal(months.reduce((n, m) => n + m.trips, 0), 3);
});

test('payouts: paid needs a UTR and only open requests change; the driver sees the UTR fields', async () => {
  const { earningsService: es } = services.admin;
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await firestore.setDoc(firestore.doc(db, 'payout_requests/pr1'), { driverId: 'ind1', amount: 500, status: 'Pending' });
    await firestore.setDoc(firestore.doc(db, 'payout_requests/pr2'), { driverId: 'ind1', amount: 300, status: 'Pending' });
    await firestore.setDoc(firestore.doc(db, 'payout_requests/pr3'), { vendorId: 'v1', amount: 700, status: 'Pending' });
  });
  await assert.rejects(es.markPayoutPaid({ id: 'pr1' }, ' ', 'admin1'), /UTR/);
  await es.markPayoutPaid({ id: 'pr1' }, 'UTR998877', 'admin1');
  const paid = await readDoc('payout_requests/pr1');
  assert.equal(paid.status, 'Paid');
  assert.equal(paid.utr, 'UTR998877');
  assert.ok(!Number.isNaN(new Date(paid.processedAt).getTime()));
  await assert.rejects(es.rejectPayout({ id: 'pr1' }, 'x', 'admin1'), /already Paid/);
  await assert.rejects(es.deferPayout({ id: 'pr2' }, '', 'admin1'), /note/);
  await es.deferPayout({ id: 'pr2' }, 'Bank holiday', 'admin1');
  await assert.rejects(es.deferPayout({ id: 'pr2' }, 'again', 'admin1'), /already Deferred/);
  await es.rejectPayout({ id: 'pr2' }, 'Details mismatch', 'admin1');
  assert.equal((await readDoc('payout_requests/pr2')).status, 'Rejected');
  await assert.rejects(es.markPayoutPaid({ id: 'missing' }, 'UTR1234', 'admin1'), /no longer exists/);
  // Partners can read but never settle their own requests.
  await assertFails(firestore.updateDoc(firestore.doc(as.vendor, 'payout_requests/pr3'), { status: 'Paid' }));
  await assertFails(firestore.updateDoc(firestore.doc(as.former, 'payout_requests/pr3'), { status: 'Paid' }));
});
// ── Penalties ───────────────────────────────────────────────────────────────

const penaltyInput = (over = {}) => ({
  party: 'Driver', partyId: 'fd1', partyName: 'Kumar', category: 'No Show at Pickup', reason: 'Driver did not reach the pickup point.',
  amount: '500', customerCompensation: '', bookingId: '', incidentDate: '2026-09-01', notes: '', applyNow: false, ...over,
});

test('penalties: validation and booking ownership', async () => {
  const { penaltyService: ps } = services.admin;
  const bookings = [{ id: 'pb1', assignedDriverId: 'fd1', assignedVendorId: 'v1' }, { id: 'pb2', assignedDriverId: 'ind1' }];
  assert.deepEqual(ps.validatePenalty(penaltyInput({ bookingId: 'pb1' }), bookings), {});
  const bad = ps.validatePenalty(penaltyInput({ partyId: '', category: 'x', reason: 'short', amount: '0', incidentDate: '2999-01-01', bookingId: 'nope' }), bookings);
  assert.ok(bad.partyId && bad.category && bad.reason && bad.amount && bad.incidentDate && bad.bookingId);
  assert.match(ps.validatePenalty(penaltyInput({ bookingId: 'pb2' }), bookings).bookingId, /not handled/);
  assert.match(ps.validatePenalty(penaltyInput({ customerCompensation: '600' }), bookings).customerCompensation, /exceed/);
  assert.equal(Object.keys(ps.validatePenalty(penaltyInput({ party: 'Vendor', partyId: 'v1', bookingId: 'pb1' }), bookings)).length, 0);
});

test('penalties: partners see their own penalties; lifecycle transitions are enforced', async () => {
  const { penaltyService: ps } = services.admin;
  const vid = await ps.createPenalty(penaltyInput({ party: 'Vendor', partyId: 'v1', partyName: 'Sri Balaji Travels', applyNow: true }), [], 'admin1');
  const did = await ps.createPenalty(penaltyInput(), [], 'admin1');
  const vdoc = await readDoc(`penalties/${vid}`);
  assert.equal(vdoc.vendorId, 'v1');
  assert.equal(vdoc.status, 'Applied');
  assert.equal(vdoc.amount, 500);
  await assertSucceeds(firestore.getDoc(firestore.doc(as.vendor, `penalties/${vid}`)));
  await assertFails(firestore.getDoc(firestore.doc(as.vendor, `penalties/${did}`)));
  const driver = env.authenticatedContext('fd1').firestore();
  await assertSucceeds(firestore.getDoc(firestore.doc(driver, `penalties/${did}`)));
  await assertFails(firestore.updateDoc(firestore.doc(as.vendor, `penalties/${vid}`), { status: 'Waived' }));

  const load = async (id) => ps.mapPenalty({ ...(await readDoc(`penalties/${id}`)), id });
  await assert.rejects(ps.transitionPenalty(await load(did), 'recover', 'UTR1', 'admin1'), /already pending/);
  await ps.transitionPenalty(await load(did), 'apply', '', 'admin1');
  await assert.rejects(ps.transitionPenalty(await load(did), 'dispute', '', 'admin1'), /required/);
  await ps.transitionPenalty(await load(did), 'dispute', 'Driver says the customer changed pickup', 'admin1');
  await ps.transitionPenalty(await load(did), 'reverse', 'Customer confirmed the change', 'admin1');
  assert.equal((await load(did)).status, 'Reversed');
  await ps.transitionPenalty(await load(vid), 'recover', 'UTR5566', 'admin1');
  const v = await load(vid);
  assert.equal(v.status, 'Recovered');
  assert.equal(v.recoveryReference, 'UTR5566');
  await assert.rejects(ps.transitionPenalty(v, 'waive', 'late', 'admin1'), /already recovered/);
  assert.deepEqual(ps.availableActions(v), []);
});

test('penalties: only pending penalties can be deleted; applied ones cannot be edited', async () => {
  const { penaltyService: ps } = services.admin;
  const id = await ps.createPenalty(penaltyInput({ amount: '300' }), [], 'admin1');
  const p = ps.mapPenalty({ ...(await readDoc(`penalties/${id}`)), id });
  await ps.updatePenalty(p, penaltyInput({ amount: '350' }), [], 'admin1');
  assert.equal((await readDoc(`penalties/${id}`)).amount, 350);
  await ps.transitionPenalty(p, 'apply', '', 'admin1');
  await assert.rejects(ps.updatePenalty(p, penaltyInput({ amount: '10' }), [], 'admin1'), /cannot be edited/);
  await assert.rejects(ps.deletePenalty(p), /Only pending/);
  const id2 = await ps.createPenalty(penaltyInput(), [], 'admin1');
  await ps.deletePenalty(ps.mapPenalty({ ...(await readDoc(`penalties/${id2}`)), id: id2 }));
  assert.equal((await firestore.getDoc(firestore.doc(as.admin, `penalties/${id2}`))).exists(), false);
  const legacy = ps.mapPenalty({ id: 'PNL-1', type: 'Vendor', entity: 'Kings', entityId: 'v9', amount: '₹2,500', status: 'Applied', date: '08 Aug 2024', reason: 'x' });
  assert.equal(legacy.party, 'Vendor');
  assert.equal(legacy.amount, 2500);
  assert.equal(ps.outstandingFor([legacy], 'Vendor', 'v9'), 2500);
});
// ── Reports ─────────────────────────────────────────────────────────────────

test('reports: GST is grouped by completion month from the server breakdown', async () => {
  const { analytics: a } = services.admin;
  const rows = a.monthlyGstSummary([
    { id: '1', status: 'Completed', fare: 945, fareBreakdown: { gst: 45 }, createdAt: new Date(2026, 7, 31), completedAt: new Date(2026, 8, 1) },
    { id: '2', status: 'Completed', fare: 1050, completedAt: { seconds: new Date(2026, 8, 15).getTime() / 1000 } },
    { id: '3', status: 'Cancelled', fare: 500, completedAt: new Date(2026, 8, 2) },
    { id: '4', status: 'Completed', fare: 210, createdAt: new Date(2026, 6, 5) },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].trips, 2);
  assert.equal(rows[0].gst, 95);
  assert.equal(rows[0].taxable, 1900);
  assert.equal(rows[0].total, 1995);
  assert.equal(rows[1].gst, 10);
  assert.equal(a.pctChange(5, 0), null);
  assert.equal(a.formatPct(12.345), '+12.3%');
});
// ── Services ────────────────────────────────────────────────────────────────

const serviceForm = (over = {}) => ({
  name: 'Airport Taxi', code: '', slug: '', serviceType: 'Airport Taxi', shortDescription: 'Airport pickups and drops.', fullDescription: '',
  icon: '✈️', imageUrl: '', status: 'Active', displayOrder: 1, featured: false, onlineBookingEnabled: true, adminBookingEnabled: true,
  allowedVehicleCategoryIds: ['sedan', 'deleted-cat'], airportOptions: { airportPickup: true, airportDrop: true },
  outstationOptions: { oneWayAllowed: false, roundTripAllowed: false }, seoTitle: '', seoDescription: '', ...over,
});

test('services: validation, auto id, category names and rename propagation', async () => {
  const { serviceMasterService: ss } = services.admin;
  const cats = await readAll(as.admin, 'vehicle_categories');
  assert.deepEqual(ss.validateService(serviceForm(), [], null), {});
  const bad = ss.validateService(serviceForm({ name: 'AB', serviceType: 'Teleport', onlineBookingEnabled: false, adminBookingEnabled: false, seoTitle: 'x'.repeat(80), displayOrder: 0 }), [], null);
  assert.ok(bad.name && bad.serviceType && bad.channels && bad.seoTitle && bad.displayOrder);
  const { id } = await ss.saveService(serviceForm(), null, cats, 'admin1');
  const saved = await readDoc(`services/${id}`);
  assert.equal(saved.code, 'AIRPORT_TAXI');
  assert.equal(saved.slug, 'airport-taxi');
  assert.deepEqual(saved.allowedVehicleCategoryIds, ['sedan']);
  assert.deepEqual(saved.allowedVehicleCategoryNames, ['Sedan']);
  assert.ok(saved.createdAt);
  const list = await readAll(as.admin, 'services');
  const dup = ss.validateService(serviceForm({ name: 'airport taxi ' }), list, null);
  assert.ok(dup.name && dup.code && dup.slug);

  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await firestore.setDoc(firestore.doc(db, 'fare_rules/sr1'), { serviceId: id, serviceName: 'Airport Taxi' });
    await firestore.setDoc(firestore.doc(db, 'coupons/sc1'), { serviceNames: ['Airport Taxi', 'Local Rental'] });
    await firestore.setDoc(firestore.doc(db, 'locations/sl1'), { serviceIds: [id] });
  });
  const existing = list.find((s) => s.id === id);
  const { renamed } = await ss.saveService(serviceForm({ name: 'Airport Transfer' }), existing, cats, 'admin1');
  assert.equal(renamed, 2);
  assert.equal((await readDoc('fare_rules/sr1')).serviceName, 'Airport Transfer');
  assert.deepEqual((await readDoc('coupons/sc1')).serviceNames, ['Airport Transfer', 'Local Rental']);
});

test('services: delete is blocked by references; activation needs a booking channel', async () => {
  const { serviceMasterService: ss } = services.admin;
  const svc = (await readAll(as.admin, 'services')).find((s) => s.name === 'Airport Transfer');
  const refs = await ss.findServiceReferences(svc, [{ id: 'b', service: 'airport transfer' }]);
  assert.deepEqual(refs, { bookings: 1, fareRules: 1, coupons: 1, locations: 1 });
  await assert.rejects(ss.deleteService(svc, []), /used by 1 fare rule, 1 coupon, 1 location/);
  await assert.rejects(ss.setServiceStatus({ ...svc, onlineBookingEnabled: false, adminBookingEnabled: false }, 'Active'), /Enable online or admin/);
  await ss.setServiceStatus(svc, 'Inactive');
  assert.equal((await readDoc(`services/${svc.id}`)).status, 'Inactive');
  const { id: lone } = await ss.saveService(serviceForm({ name: 'Recurring Staff Commute', serviceType: 'Recurring Transport' }), null, [], 'admin1');
  await ss.deleteService({ id: lone, name: 'Recurring Staff Commute' }, []);
  assert.equal((await firestore.getDoc(firestore.doc(as.admin, `services/${lone}`))).exists(), false);
  await assertFails(firestore.setDoc(firestore.doc(as.vendor, 'services/x'), { name: 'Hack' }));
});
// ── Tour packages ───────────────────────────────────────────────────────────

const future = (days) => iso(days);
const packageForm = (over = {}) => ({
  name: 'Madurai Rameswaram Pilgrimage', code: '', slug: '', shortDescription: '', fullDescription: '',
  destinations: ['Madurai', 'Rameswaram', 'Madurai'], durationDays: 2, durationNights: 1,
  itinerary: [{ dayNumber: 1, title: 'Madurai to Rameswaram', description: '' }, { dayNumber: 2, title: 'Return', description: '' }],
  pricingModel: 'Per Package', basePrice: 9000, offerPrice: 8500, adultPrice: 0, childPrice: 0,
  allowedVehicleCategoryIds: ['sedan'], preferredVendorId: 'v1', departures: [{ id: 'dep-1', date: future(10), time: '06:00', status: 'Available' }],
  inclusions: ['AC vehicle', '', ' Driver allowance '], exclusions: [], coverImageUrl: '', status: 'Active', featured: false, displayOrder: 1,
  seoTitle: '', seoDescription: '', ...over,
});

test('tour packages: validation covers route, duration, itinerary, pricing models and departures', async () => {
  const { tourPackageService: ts } = services.admin;
  assert.deepEqual(ts.validatePackage(packageForm(), [], null), {});
  const bad = ts.validatePackage(packageForm({ destinations: ['Madurai'], durationNights: 5, itinerary: [{ title: '' }, { title: 'x' }, { title: 'y' }], offerPrice: 9500, departures: [{ id: 'n', date: iso(-2), status: 'Available' }] }), [], null);
  assert.ok(bad.destinations && bad.durationNights && bad.itinerary && bad.offerPrice && bad.departures);
  const perPerson = ts.validatePackage(packageForm({ pricingModel: 'Per Person', adultPrice: 3000, childPrice: 4000 }), [], null);
  assert.match(perPerson.childPrice, /exceed/);
  assert.match(ts.validatePackage(packageForm({ pricingModel: 'Vehicle Based', allowedVehicleCategoryIds: [] }), [], null).allowedVehicleCategoryIds, /at least one/);
  assert.match(ts.validatePackage(packageForm({ itinerary: [] }), [], null).itinerary, /before making the package active/);
  // An already-saved past departure may stay on edit; a new one may not.
  const saved = [{ id: 'p1', name: 'Other', code: 'OTHER', departures: [{ id: 'old', date: iso(-30), status: 'Available' }] }];
  assert.equal(ts.validatePackage(packageForm({ departures: [{ id: 'old', date: iso(-30), status: 'Available' }] }), saved, 'p1').departures, undefined);
});

test('tour packages: save derives route ends, published flag and names; duplicate and delete are safe', async () => {
  const { tourPackageService: ts } = services.admin;
  const cats = await readAll(as.admin, 'vehicle_categories');
  const vendors = await readAll(as.admin, 'vendors');
  const id = await ts.savePackage(packageForm(), null, cats, vendors, 'admin1');
  const pkg = await readDoc(`tour_packages/${id}`);
  assert.equal(pkg.startingLocation, 'Madurai');
  assert.equal(pkg.endingLocation, 'Madurai');
  assert.equal(pkg.published, true);
  assert.deepEqual(pkg.allowedVehicleCategoryNames, ['Sedan']);
  assert.equal(pkg.preferredVendorName, 'Sri Balaji Travels');
  assert.deepEqual(pkg.inclusions, ['AC vehicle', 'Driver allowance']);
  const all = await readAll(as.admin, 'tour_packages');
  const d1 = await ts.duplicatePackage({ ...pkg, id }, all, 'admin1');
  const d2 = await ts.duplicatePackage({ ...pkg, id }, await readAll(as.admin, 'tour_packages'), 'admin1');
  assert.notEqual(d1.name, d2.name);
  const copy = await readDoc(`tour_packages/${d1.id}`);
  assert.equal(copy.status, 'Draft');
  assert.equal(copy.published, false);
  assert.deepEqual(copy.departures, []);
  await assert.rejects(ts.deletePackage({ ...pkg, id }), /upcoming departures/);
  await env.withSecurityRulesDisabled((c) => firestore.setDoc(firestore.doc(c.firestore(), 'coupons/tp1'), { tourPackageIds: [d1.id] }));
  await assert.rejects(ts.deletePackage({ ...copy, id: d1.id }), /1 coupon/);
  await ts.deletePackage({ ...(await readDoc(`tour_packages/${d2.id}`)), id: d2.id });
  assert.equal((await firestore.getDoc(firestore.doc(as.admin, `tour_packages/${d2.id}`))).exists(), false);
  await ts.setPackageStatus({ ...pkg, id }, 'Archived');
  const archived = await readDoc(`tour_packages/${id}`);
  assert.equal(archived.status, 'Archived');
  assert.equal(archived.published, false);
  await assert.rejects(ts.setPackageStatus({ ...copy, id: d1.id, itinerary: [] }, 'Active'), /itinerary/);
});
// ── Locations ───────────────────────────────────────────────────────────────

const locationForm = (over = {}) => ({
  name: 'Madurai Junction', code: '', type: 'Railway Station', state: 'Tamil Nadu', district: '', city: 'Madurai', area: '',
  pincode: '', address: '', parentLocationId: '', lat: '', lng: '', placeId: '', pickupEnabled: true, dropEnabled: true,
  onlineBookingEnabled: true, adminBookingEnabled: true, serviceIds: [], status: 'Active', displayOrder: 1, ...over,
});

test('locations: creating with optional fields empty succeeds (no undefined values)', async () => {
  const { locationService: ls } = services.admin;
  const { id } = await ls.saveLocation(locationForm(), null, [], 'admin1');
  const loc = await readDoc(`locations/${id}`);
  assert.equal(loc.code, 'MADURAIJUN');
  assert.equal(loc.lat, null);
  assert.equal(loc.parentLocationId, '');
  assert.ok(loc.createdAt);
});

test('locations: validation — duplicates, PIN, coordinates in India, parent cycles, usage', async () => {
  const { locationService: ls } = services.admin;
  const all = await readAll(as.admin, 'locations');
  const mj = all.find((l) => l.name === 'Madurai Junction');
  assert.match(ls.validateLocation(locationForm({ name: 'madurai junction ' }), all, null).name, /already exists/);
  assert.equal(ls.validateLocation(locationForm({ name: 'Madurai Junction', city: 'Dindigul', code: 'MDU2' }), all, null).name, undefined);
  const bad = ls.validateLocation(locationForm({ pincode: '012345', lat: '51.5', lng: '', pickupEnabled: false, dropEnabled: false, code: 'X' }), all, null);
  assert.ok(bad.pincode && bad.lng && bad.usage && bad.code);
  assert.match(ls.validateLocation(locationForm({ lat: '51.5', lng: '-0.12' }), all, null).lat, /within India/);
  const { id: child } = await ls.saveLocation(locationForm({ name: 'Platform Gate', type: 'Landmark', parentLocationId: mj.id }), null, all, 'admin1');
  const all2 = await readAll(as.admin, 'locations');
  assert.match(ls.validateLocation(locationForm({ parentLocationId: child }), all2, mj.id).parentLocationId, /inside itself/);
});

test('locations: rename propagates; delete blocked by fare rules, coupons and sub-locations', async () => {
  const { locationService: ls } = services.admin;
  const all = await readAll(as.admin, 'locations');
  const mj = all.find((l) => l.name === 'Madurai Junction');
  await env.withSecurityRulesDisabled((c) => firestore.setDoc(firestore.doc(c.firestore(), 'fare_rules/lr1'), { originLocationId: mj.id, originLocationName: 'Madurai Junction' }));
  const { renamed } = await ls.saveLocation(locationForm({ name: 'Madurai Railway Junction', code: 'MDU' }), mj, all, 'admin1');
  assert.equal(renamed, 2);
  assert.equal((await readDoc('fare_rules/lr1')).originLocationName, 'Madurai Railway Junction');
  const child = all.find((l) => l.parentLocationId === mj.id);
  assert.equal((await readDoc(`locations/${child.id}`)).parentLocationName, 'Madurai Railway Junction');
  const refs = await ls.findLocationReferences({ ...mj, name: 'Madurai Railway Junction' }, [{ destinations: ['Madurai Railway Junction'] }]);
  assert.deepEqual(refs, { fareRules: 1, coupons: 0, children: 1, packages: 1 });
  await assert.rejects(ls.deleteLocation(mj, []), /1 fare rule, 1 sub-location/);
  await ls.deleteLocation({ ...child, name: 'Platform Gate' }, []);
  assert.equal((await firestore.getDoc(firestore.doc(as.admin, `locations/${child.id}`))).exists(), false);
  await ls.setLocationStatus(mj, 'Inactive');
  assert.equal((await readDoc(`locations/${mj.id}`)).status, 'Inactive');
});

// ── Pricing & fare ──────────────────────────────────────────────────────────

const bookingEngine = loadAdminModule('services/bookingFareEngine.ts', { '../types': {} });
const rateCardEngine = loadAdminModule('services/fareEngine.ts', { '../types': {} });

test('pricing: the admin customer-fare preview matches the booking server exactly', () => {
  const server = loadServerPricing();
  const docs = {
    sedan: { name: 'Sedan', fare: { baseFare: 100, baseKm: 3, perKmRate: 14, waitingChargePerHour: 120, minimumFare: 250, nightAllowance: 150, driverAllowance: 300 } },
    suv: { name: 'SUV', fare: { perKmRate: 18, perMinuteRate: 1.5, outstationPerKmRate: 16, outstationDriverBattaPerDay: 500, driverAllowance: 300 } },
    mini: { name: 'Mini', fare: { perKmRate: 11.5 } },
    norate: { name: 'No Rate', fare: { baseFare: 200 } },
    noname: { name: '', fare: { perKmRate: 10 } },
    textrate: { name: 'Legacy', fare: { perKmRate: '12' } },
    nofare: { name: 'No Fare' },
  };
  // 10:00, 23:30, 05:59 and 06:00 in Asia/Kolkata.
  const pickups = ['2026-09-30T04:30:00Z', '2026-09-30T18:00:00Z', '2026-09-30T00:29:00Z', '2026-09-30T00:30:00Z'].map((s) => new Date(s));
  let compared = 0;
  for (const [id, d] of Object.entries(docs)) {
    const s = server.mapCategory(id, d);
    const a = bookingEngine.toEngineCategory({ id, ...d });
    assert.equal(a === null, s === null, `${id}: bookable in one engine only`);
    if (!s) continue;
    assert.deepEqual(a.fare, s.fare, `${id}: fare mapping differs`);
    for (const distanceKm of [2, 12.4, 40, 41, 250])
      for (const durationMin of [0, 35, 800])
        for (const tripType of ['One Way', 'Round Trip'])
          for (const pickupTime of pickups)
            for (const discount of [0, 75, 999999]) {
              const want = server.calculateFare({ category: s, route: { distanceKm, durationMin }, tripType, pickupTime, discount });
              const got = bookingEngine.calculateBookingFare({ category: a, distanceKm, durationMin, tripType, pickupTime, discount });
              assert.deepEqual(got, want, `${id} ${distanceKm}km ${durationMin}min ${tripType} ${pickupTime.toISOString()} -${discount}`);
              compared++;
            }
  }
  assert.equal(compared, 3 * 5 * 3 * 2 * 4 * 3);
});

const fareForm = (over = {}) => ({
  ...services.admin.fareRuleService.emptyFareRuleForm(),
  name: 'Airport Sedan',
  vehicleCategoryId: 'sedan',
  baseFare: 200,
  perKmRate: 15,
  ...over,
});
const FARE_CTX = { services: [{ id: 'svcA', name: 'Airport Transfer' }], categories: [{ id: 'sedan', name: 'Sedan' }], locations: [{ id: 'l1', name: 'Madurai' }, { id: 'l2', name: 'Theni' }] };

test('fare rules: validation — required fields, model rules, night window, priority, dates', () => {
  const { fareRuleService: fr } = services.admin;
  const blank = fr.validateFareRule(fr.emptyFareRuleForm(), [], null);
  assert.ok(blank.name && blank.vehicleCategoryId && blank.perKmRate);
  assert.deepEqual(fr.validateFareRule(fareForm(), [], null), {});
  assert.ok(fr.validateFareRule(fareForm({ pricingType: 'FIXED_ROUTE' }), [], null).originLocationId);
  assert.match(fr.validateFareRule(fareForm({ pricingType: 'FIXED_ROUTE', originLocationId: 'l1', destinationLocationId: 'l1' }), [], null).destinationLocationId, /differ/);
  const hourly = fr.validateFareRule(fareForm({ pricingType: 'HOURLY_RENTAL', baseFare: 0 }), [], null);
  assert.ok(hourly.baseFare && hourly.includedHours && hourly.baseKm);
  assert.ok(fr.validateFareRule(fareForm({ pricingType: 'PER_DAY' }), [], null).minimumKmPerDay);
  const night = fr.validateFareRule(fareForm({ nightChargeEnabled: true, nightStartTime: '25:00', nightEndTime: '05:00', nightChargeValue: 150 }), [], null);
  assert.ok(night.nightStartTime);
  assert.match(night.nightChargeValue, /100/);
  assert.ok(fr.validateFareRule(fareForm({ tollMode: 'Fixed' }), [], null).fixedTollAmount);
  assert.ok(fr.validateFareRule(fareForm({ baseFare: -1 }), [], null).baseFare);
  assert.ok(fr.validateFareRule(fareForm({ priority: 0 }), [], null).priority);
  assert.ok(fr.validateFareRule(fareForm({ priority: 1.5 }), [], null).priority);
  assert.match(fr.validateFareRule(fareForm({ effectiveFrom: '2026-10-10', effectiveUntil: '2026-10-01' }), [], null).effectiveUntil, /before/);
});

test('fare rules: duplicates and active clashes on the same scope, priority and period', () => {
  const { fareRuleService: fr } = services.admin;
  const existing = [{ id: 'r1', name: 'Airport Sedan', code: 'AIR-SED', status: 'Active', vehicleCategoryId: 'sedan', serviceId: '', pricingType: 'BASE_PLUS_PER_KM', priority: 1 }];
  assert.match(fr.validateFareRule(fareForm({ name: ' airport sedan ' }), existing, null).name, /already/);
  assert.equal(fr.validateFareRule(fareForm({ name: 'Airport Sedan' }), existing, 'r1').name, undefined);
  assert.match(fr.validateFareRule(fareForm({ name: 'Other', code: 'air-sed' }), existing, null).code, /already/);
  assert.match(fr.validateFareRule(fareForm({ name: 'Other' }), existing, null).priority, /Airport Sedan/);
  assert.deepEqual(fr.validateFareRule(fareForm({ name: 'Other', priority: 2 }), existing, null), {});
  assert.deepEqual(fr.validateFareRule(fareForm({ name: 'Other', serviceId: 'svcA' }), existing, null), {});
  assert.deepEqual(fr.validateFareRule(fareForm({ name: 'Other', status: 'Inactive' }), existing, null), {});
  const expired = [{ ...existing[0], effectiveUntil: '2020-12-31' }];
  assert.deepEqual(fr.validateFareRule(fareForm({ name: 'Other', effectiveFrom: '2026-01-01' }), expired, null), {});
});

test('fare rules: create, edit, duplicate, activate and delete through the rules', async () => {
  const { fareRuleService: fr } = services.admin;
  const id = await fr.saveFareRule(fareForm({ name: 'Rule Save Test', serviceId: 'svcA', code: 'rst-1' }), null, FARE_CTX, 'admin1');
  const created = await readDoc(`fare_rules/${id}`);
  assert.equal(created.serviceName, 'Airport Transfer');
  assert.equal(created.vehicleCategoryName, 'Sedan');
  assert.equal(created.code, 'RST-1');
  assert.equal(created.originLocationName, '');
  assert.equal(created.nightStartTime, '');
  assert.equal(created.createdBy, 'admin1');
  assert.ok(created.createdAt && created.updatedAt);

  const rule = { ...created, id };
  await fr.saveFareRule({ ...fr.formFromRule(rule), baseFare: 250 }, rule, FARE_CTX, 'admin1');
  const edited = await readDoc(`fare_rules/${id}`);
  assert.equal(edited.baseFare, 250);
  assert.equal(edited.createdAt.toMillis(), created.createdAt.toMillis());

  const rules = (await readAll(as.admin, 'fare_rules')).filter((r) => r.name);
  const copyName = await fr.duplicateFareRule(rule, rules, 'admin1');
  assert.equal(copyName, 'Rule Save Test (Copy)');
  const copy = (await readAll(as.admin, 'fare_rules')).find((r) => r.name === copyName);
  assert.equal(copy.status, 'Inactive');
  assert.equal(copy.code, '');

  const all = await readAll(as.admin, 'fare_rules');
  await assert.rejects(fr.setFareRuleStatus(copy, 'Active', all), /Cannot activate: .*Rule Save Test/);
  await fr.setFareRuleStatus({ ...edited, id }, 'Inactive', all);
  await fr.setFareRuleStatus(copy, 'Active', await readAll(as.admin, 'fare_rules'));
  assert.equal((await readDoc(`fare_rules/${copy.id}`)).status, 'Active');

  await fr.deleteFareRule(copy);
  assert.equal((await firestore.getDoc(firestore.doc(as.admin, `fare_rules/${copy.id}`))).exists(), false);

  const formerFr = servicesFor(as.former).fareRuleService;
  await assert.rejects(formerFr.saveFareRule(fareForm({ name: 'Sneaky' }), null, FARE_CTX, 'former'), formerFr.FareRuleActionError);
});

test('rate card: priority, effective dates, service scope and no invented prices', () => {
  const base = { status: 'Active', vehicleCategoryId: 'sedan', pricingType: 'PER_KM', baseFare: 0, baseKm: 0, driverBatta: 0 };
  const rules = [
    { ...base, id: 'low', name: 'Low priority', perKmRate: 10, priority: 5 },
    { ...base, id: 'high', name: 'High priority', perKmRate: 12, priority: 2 },
    { ...base, id: 'old', name: 'Expired', perKmRate: 9, priority: 1, effectiveUntil: '2020-12-31' },
    { ...base, id: 'later', name: 'Future', perKmRate: 8, priority: 1, effectiveFrom: '2999-01-01' },
    { ...base, id: 'off', name: 'Inactive', perKmRate: 7, priority: 1, status: 'Inactive' },
    { ...base, id: 'svc', name: 'Service', perKmRate: 20, priority: 9, serviceId: 'svcA' },
  ];
  const input = { vehicleCategoryId: 'sedan', distanceKm: 10 };
  assert.equal(rateCardEngine.findMatchingFareRule(rules, input).id, 'high');
  assert.equal(rateCardEngine.findMatchingFareRule(rules, input, new Date(2020, 5, 1)).id, 'old');
  assert.equal(rateCardEngine.findMatchingFareRule(rules, { ...input, serviceId: 'svcA' }).id, 'svc');
  const quote = rateCardEngine.calculateCentralFare(input, rules, []);
  assert.equal(quote.matchedRule.id, 'high');
  assert.equal(quote.distanceFare, 120);
  assert.equal(quote.grandTotal, 126);

  const sedan = (fare) => [{ id: 'sedan', name: 'Sedan', fare }];
  assert.equal(rateCardEngine.calculateCentralFare(input, [], []), null);
  assert.equal(rateCardEngine.calculateCentralFare(input, [], sedan({ perKmRate: 0, baseFare: 300 })), null);
  const fallback = rateCardEngine.calculateCentralFare({ ...input, pickupTime: '12:00' }, [], sedan({ baseFare: 100, baseKm: 0, perKmRate: 12, driverAllowance: 400, nightAllowance: 150 }));
  assert.equal(fallback.fallbackUsed, true);
  assert.equal(fallback.matchedRule, null);
  assert.equal(fallback.driverBatta, 0);
  assert.equal(fallback.nightCharge, 0);
  assert.equal(fallback.grandTotal, 231);
  const night = rateCardEngine.calculateCentralFare({ ...input, pickupTime: '23:15' }, [], sedan({ baseFare: 100, baseKm: 0, perKmRate: 12, nightAllowance: 150 }));
  assert.equal(night.nightCharge, 150);
  const out = rateCardEngine.calculateCentralFare({ ...input, distanceKm: 100 }, [], sedan({ perKmRate: 12, outstationPerKmRate: 11, driverAllowance: 400 }));
  assert.equal(out.distanceFare, 1100);
  assert.equal(out.driverBatta, 400);

  const tolls = { ...input, tollAmount: 80, parkingAmount: 40 };
  const included = rateCardEngine.calculateCentralFare(tolls, [{ ...rules[1], tollMode: 'Included', parkingMode: 'Included' }], []);
  assert.equal(included.tollAmount + included.parkingAmount, 0);
  const excluded = rateCardEngine.calculateCentralFare(tolls, [{ ...rules[1], tollMode: 'Excluded', parkingMode: 'Fixed', fixedParkingAmount: 60 }], []);
  assert.equal(excluded.tollAmount, 80);
  assert.equal(excluded.parkingAmount, 60);
  const minimum = rateCardEngine.calculateCentralFare({ ...input, distanceKm: 2 }, [{ ...rules[1], minimumFare: 300 }], []);
  assert.equal(minimum.subtotal, 300);
});

// ── Customer web ↔ server pricing parity ────────────────────────────────────

/** Loads a customer-web TS module (import.meta.env is empty under test). */
function loadWebModule(relPath, modules) {
  const source = readFileSync(new URL(`../../user/web/src/${relPath}`, import.meta.url), 'utf8').replaceAll('import.meta.env', '({})');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = {};
  new Function('require', 'exports', outputText)((name) => {
    if (name in modules) return modules[name];
    throw new Error(`Unexpected import ${name} from ${relPath}`);
  }, exports);
  return exports;
}

function webPricing(onSnapshot) {
  const fakeFirestore = { collection: () => ({}), query: () => ({}), where: () => ({}), onSnapshot };
  return loadWebModule('services/pricingService.ts', {
    'firebase/firestore': fakeFirestore,
    './firebase': { db: {} },
    '../config/constants': loadWebModule('config/constants.ts', {}),
    '../types': {},
  });
}

const PARITY_DOCS = {
  sedan: { name: 'Sedan', displayOrder: 2, fare: { baseFare: 100, baseKm: 3, perKmRate: 14, waitingChargePerHour: 120, minimumFare: 250, nightAllowance: 150, driverAllowance: 300 } },
  suv: { name: 'SUV', displayOrder: 3, fare: { perKmRate: 18, perMinuteRate: 1.5, outstationPerKmRate: 16, outstationDriverBattaPerDay: 500, driverAllowance: 300 } },
  mini: { name: 'Mini', displayOrder: 1, fare: { perKmRate: 11.5 } },
  norate: { name: 'No Rate', fare: { baseFare: 200 } },
  textrate: { name: 'Legacy', fare: { perKmRate: '12' } },
};

test('pricing: customer web shows exactly the server-priceable categories — never built-in ones', () => {
  const server = loadServerPricing();
  const emitted = [];
  const snapshotOf = (docs) => ({ docs: Object.entries(docs).map(([id, d]) => ({ id, data: () => d })) });
  let mode = 'docs';
  const web = webPricing((_q, next, fail) => {
    if (mode === 'docs') next(snapshotOf(PARITY_DOCS));
    else if (mode === 'empty') next(snapshotOf({ norate: PARITY_DOCS.norate }));
    else fail(new Error('permission-denied'));
    return () => {};
  });
  web.subscribeToRideCategories((cats, status) => emitted.push({ ids: cats.map((c) => c.id), status, cats }));
  assert.deepEqual(emitted.map((e) => e.status), ['loading', 'ready']);
  assert.deepEqual(emitted[0].ids, []);
  assert.deepEqual(emitted[1].ids, ['mini', 'sedan', 'suv']);
  for (const c of emitted[1].cats) assert.deepEqual(c.fare, server.mapCategory(c.id, PARITY_DOCS[c.id]).fare, c.id);

  for (const [m, status] of [['empty', 'unavailable'], ['error', 'error']]) {
    mode = m;
    const seen = [];
    web.subscribeToRideCategories((cats, s) => seen.push([cats.length, s]));
    assert.deepEqual(seen, [[0, 'loading'], [0, status]]);
  }
});

test('pricing: customer web fares and coupons match the server exactly (India time)', () => {
  const server = loadServerPricing();
  const web = webPricing(() => () => {});
  const pickups = ['2026-09-30T04:30:00Z', '2026-09-30T16:29:00Z', '2026-09-30T16:30:00Z', '2026-09-30T00:29:00Z', '2026-09-30T00:30:00Z'].map((s) => new Date(s));
  for (const id of ['sedan', 'suv', 'mini']) {
    const category = server.mapCategory(id, PARITY_DOCS[id]);
    for (const distanceKm of [2, 12.4, 40, 41, 250])
      for (const durationMin of [0, 35, 800])
        for (const tripType of ['One Way', 'Round Trip'])
          for (const pickupTime of pickups)
            for (const discount of [0, 75, 999999]) {
              const args = { category, route: { distanceKm, durationMin }, tripType, pickupTime, discount };
              assert.deepEqual(web.calculateFare(args), server.calculateFare(args), `${id} ${distanceKm} ${tripType} ${pickupTime.toISOString()}`);
            }
  }
  // Night is decided in India time on both sides (22:00 IST = 16:30 UTC).
  assert.equal(web.isNightTime(new Date('2026-09-30T16:29:00Z')), false);
  assert.equal(web.isNightTime(new Date('2026-09-30T16:30:00Z')), true);
  assert.equal(web.isNightTime(new Date('2026-09-30T00:30:00Z')), false);

  const coupons = [
    { code: 'AIRPORT10', discountType: 'PERCENTAGE', discountValue: 10, maximumDiscount: 150, serviceNames: ['Airport'], status: 'Active' },
    { code: 'FLAT100', discountType: 'FIXED_AMOUNT', discountValue: 100, minimumBookingAmount: 500, validFrom: '2020-01-01', validUntil: '2999-12-31', status: 'Active' },
    { code: 'OLD', discountType: 'FIXED_AMOUNT', discountValue: 50, validUntil: '2020-01-01', status: 'Active' },
    { code: 'DESK', discountType: 'FIXED_AMOUNT', discountValue: 50, adminBookingOnly: true, status: 'Active' },
    { code: 'TEXT50', discountType: 'FIXED_AMOUNT', discountValue: '50', status: 'Active' },
  ].map((c, i) => server.mapCoupon(`c${i}`, c));
  for (const code of ['airport10', 'FLAT100', 'OLD', 'DESK', 'TEXT50', 'NOPE'])
    for (const ctx of [
      { subtotal: 2000, categoryId: 'sedan', service: 'Airport', isFirstBooking: true, customerUses: 0 },
      { subtotal: 400, categoryId: 'sedan', service: 'Local', isFirstBooking: false, customerUses: 1 },
    ])
      assert.deepEqual(web.validateCoupon(coupons, code, ctx), server.validateCoupon(coupons, code, ctx), `${code} ${ctx.service}`);
});

test('rules: bookings are created and priced only by the server; admins cannot type a fare', async () => {
  await env.withSecurityRulesDisabled((c) =>
    firestore.setDoc(firestore.doc(c.firestore(), 'bookings/priced1'), { status: 'Pending', fare: 945, fareBreakdown: { total: 945 }, customer: 'A', payment: 'Pending' }),
  );
  await assertFails(firestore.setDoc(firestore.doc(as.admin, 'bookings/typed1'), { status: 'Pending', fare: 1, customer: 'X' }));
  await assertFails(firestore.updateDoc(firestore.doc(as.admin, 'bookings/priced1'), { fare: 10 }));
  await assertFails(firestore.updateDoc(firestore.doc(as.admin, 'bookings/priced1'), { fareBreakdown: { total: 10 } }));
  await assertFails(firestore.updateDoc(firestore.doc(as.admin, 'bookings/priced1'), { fareOverride: { overriddenFare: 10 } }));
  await assertSucceeds(firestore.updateDoc(firestore.doc(as.admin, 'bookings/priced1'), { customer: 'A. Kumar', notes: 'Call on arrival' }));
  // Writing the whole document back unchanged (merge) is still allowed.
  await assertSucceeds(firestore.setDoc(firestore.doc(as.admin, 'bookings/priced1'), { fare: 945, status: 'Confirmed' }, { merge: true }));
});

test('pricing downstream: an overridden fare invoices, collects and reports the charged amount', () => {
  const server = loadServerPricing();
  const { invoiceService, paymentService, analytics } = services.admin;
  const category = server.mapCategory('sedan', PARITY_DOCS.sedan);
  const calculated = server.calculateFare({ category, route: { distanceKm: 30, durationMin: 50 }, tripType: 'One Way', pickupTime: new Date('2026-09-30T06:00:00Z') });
  for (const charged of [calculated.total + 137, calculated.total - 90, 1000, 10]) {
    const fb = server.applyFareOverride(calculated, charged);
    assert.equal(fb.taxableAmount + fb.gst, charged);
    assert.equal(fb.baseFare + fb.distanceFare + fb.timeFare + fb.nightCharge + fb.driverAllowance + fb.minimumFareAdjustment + fb.adminAdjustment, fb.subtotal);
    const booking = { id: `ov${charged}`, status: 'Completed', fare: charged, fareBreakdown: fb, fareVerified: true, tollCharges: 60, tollsApproved: true, paymentMethod: 'UPI', service: 'Local', pickup: 'A', drop: 'B' };
    const lines = invoiceService.buildInvoiceLines(booking);
    assert.equal(lines.grandTotal, charged + 60);
    assert.equal(lines.totalTax, fb.gst);
    assert.equal(lines.taxableAmount, fb.taxableAmount);
    assert.equal(Math.round(lines.items.reduce((s, i) => s + i.amount, 0) * 100) / 100, fb.subtotal + 60);
    assert.equal(paymentService.expectedAmount(booking), charged + 60);
    assert.equal(analytics.bookingGst(booking), fb.gst);
  }
});

test('staff permissions: admin panel, server and security rules use one permission list', async () => {
  const adminPerms = loadAdminModule('config/permissions.ts', {});
  const serverPerms = await import('../../functions/lib/permissions.js');
  assert.deepEqual([...adminPerms.PERMISSIONS], [...serverPerms.PERMISSIONS]);
  const used = (file) => new Set([...readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8').matchAll(/can\('([a-z]+)'\)/g)].map((m) => m[1]));
  const inRules = used('firestore.rules');
  for (const p of inRules) assert.ok(adminPerms.PERMISSIONS.includes(p), `firestore.rules uses unknown permission ${p}`);
  for (const p of used('storage.rules')) assert.ok(adminPerms.PERMISSIONS.includes(p), `storage.rules uses unknown permission ${p}`);
  // Every permission guards something in the database (reports: financial reads).
  for (const p of adminPerms.PERMISSIONS) assert.ok(inRules.has(p), `permission ${p} is never enforced by firestore.rules`);
  // Legacy admins (no staffRole) keep full access; unknown permissions are ignored.
  const legacy = adminPerms.accessFromAdminDoc({ role: 'admin', status: 'active' });
  assert.equal(legacy.isSuper, true);
  assert.equal(adminPerms.canAccessPage(legacy, 'staff'), true);
  const ops = adminPerms.accessFromAdminDoc({ staffRole: 'r1', permissions: ['operations', 'bogus'], roleName: 'Dispatcher' });
  assert.deepEqual(ops.permissions, ['operations']);
  assert.equal(adminPerms.canAccessPage(ops, 'bookings'), true);
  assert.equal(adminPerms.canAccessPage(ops, 'payments'), false);
  assert.equal(adminPerms.canAccessPage(ops, 'staff'), false);
  assert.equal(adminPerms.canAccessPage(ops, 'dashboard'), true);
});

// ── Phase B: no fabricated values in partner and customer views ─────────────

/** Loads a TS module from another web app (vendor/web, driver/web); only type imports allowed. */
function loadAppModule(app, relPath, modules = {}) {
  const source = readFileSync(new URL(`../../${app}/src/${relPath}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = {};
  new Function('require', 'exports', outputText)((name) => {
    if (name in modules) return modules[name];
    throw new Error(`Unexpected import ${name} from ${app}/${relPath}`);
  }, exports);
  return exports;
}

test('customers: statistics are derived from bookings, never from stored counters', () => {
  const cs = loadAdminModule('services/customerStats.ts', { '../utils/analytics': services.admin.analytics, './paymentService': services.admin.paymentService });
  const customers = [
    { id: 'c1', phone: '+91 98765 43210', bookings: 99, spent: '₹99,999' }, // legacy stored counters are ignored
    { id: 'c2', phone: '9000000002' },
    { id: 'c3', phone: '9000000002' }, // same number as c2: unlinked bookings can't be attributed
  ];
  const at = (d) => new Date(2026, 8, d);
  const bookings = [
    { id: 'b1', customerId: 'c1', status: 'Completed', payment: 'Paid', fare: 1000, tollCharges: 50, createdAt: at(1) },
    { id: 'b2', customerId: 'c1', status: 'Completed', payment: 'Pending', fare: '₹1,200', createdAt: at(5) },
    { id: 'b3', customerId: 'c1', status: 'Cancelled', fare: 800, createdAt: at(3) },
    { id: 'b4', customerId: '', phone: '98765-43210', status: 'Pending', fare: 500, createdAt: at(9) }, // admin phone booking
    { id: 'b5', customerId: '', phone: '9000000002', status: 'Completed', payment: 'Paid', fare: 700 },
    { id: 'b6', customerId: 'someone-else', status: 'Completed', payment: 'Paid', fare: 400 },
  ];
  const stats = cs.buildCustomerStats(customers, bookings);
  const c1 = stats.get('c1');
  assert.deepEqual([c1.total, c1.completed, c1.cancelled, c1.paid, c1.outstanding], [4, 2, 1, 1050, 1200]);
  assert.equal(c1.lastBookingAt.getTime(), at(9).getTime());
  assert.deepEqual([stats.get('c2').total, stats.get('c3').total], [0, 0]);
  assert.equal(stats.get('c2').lastBookingAt, null);
  assert.equal(cs.phoneKey('+91 98765 43210'), '9876543210');
});

test('vendor portal: mappers show only recorded values — no sample vehicles, phones, ratings or payouts', () => {
  const m = loadAppModule('vendor/web', 'services/vendorMappers.ts');
  const v = m.mapVehicle('veh1', { verified: true });
  assert.deepEqual([v.id, v.vehicleNumber, v.make, v.model, v.year, v.seatingCapacity, v.status, v.docStatus], ['veh1', '', '', '', '', null, 'Active', 'Pending']);
  assert.equal(m.dispatchableVehicle(v), false);
  assert.equal(m.dispatchableVehicle(m.mapVehicle('veh2', { vehicleNumber: 'TN01AB1234', docStatus: 'Approved', status: 'Active' })), true);
  assert.equal(m.dispatchableVehicle(m.mapVehicle('veh3', { vehicleNumber: 'TN01AB1234', docStatus: 'Approved', status: 'Maintenance' })), false);

  const d = m.mapDriver('drv1', { rating: 5, totalTrips: 120, status: 'Approved' });
  assert.deepEqual([d.name, d.phone, d.email, d.photoUrl, d.rating, d.accountStatus, d.suspended, d.online], ['', '', '', '', null, 'Approved', false, false]);
  assert.equal(m.mapDriver('drv2', { rating: 4.6, ratingCount: 12 }).rating, 4.6);
  assert.equal(m.dispatchableDriver(m.mapDriver('drv3', { status: 'Approved', fleetStatus: 'Suspended' })), false);

  const t = m.mapOpenTrip('trip1', {});
  assert.deepEqual([t.bookingId, t.route, t.travelDate, t.vehicleCategory, t.distanceKm, t.offeredPayout], ['trip1', '', '', '', null, null]);
  assert.equal(m.mapOpenTrip('trip2', { offeredPayout: 0 }).offeredPayout, null);

  const vt = m.mapVendorTrip('bk1', { fare: '₹1,250' });
  assert.deepEqual([vt.grossFare, vt.vendorPayout, vt.customerName, vt.customerPhone, vt.driverPhone, vt.vehicleNumber, vt.scheduledTime], [1250, null, '', '', '', '', '']);
  assert.equal(m.mapVendorTrip('bk2', { fare: 1000, vendorPayout: 780 }).vendorPayout, 780);

  assert.deepEqual(m.mapWallet(undefined), m.EMPTY_WALLET);
  assert.equal(m.mapWallet({ available: -500 }).available, -500);
  assert.equal(m.mapLedgerEntry('old', { vendorId: 'v1', amount: 900 }), null);
  assert.equal(m.mapLedgerEntry('trip_1', { schema: 2, type: 'trip_earning', direction: 'credit', netAmount: 900, status: 'pending' }).amount, 900);
});

test('driver app: earnings and wallet come from the server ledger', () => {
  const e = loadAppModule('driver/web', 'services/driverEarnings.ts');
  const now = new Date(2026, 8, 30, 12);
  const entry = (id, over) => ({ id, type: 'trip_earning', direction: 'credit', amount: 700, status: 'available', bookingId: id, bookingCode: '', createdAt: now, ...over });
  const ledger = [
    entry('t1'),
    entry('t2', { status: 'pending', createdAt: new Date(2026, 8, 26) }),
    entry('toll1', { type: 'toll_reimbursement', amount: 100 }),
    entry('t3', { status: 'cancelled' }),
    entry('cash1', { type: 'cash_collected', direction: 'debit', amount: 1000, status: 'completed' }),
    entry('t4', { createdAt: new Date(2026, 5, 1) }),
  ];
  const s = e.summarizeEarnings(ledger, now);
  assert.deepEqual(
    [s.todayEarnings, s.thisWeekEarnings, s.thisMonthEarnings, s.lifetimeEarnings, s.totalTripsCompleted, s.tollReimbursements],
    [800, 1500, 1500, 2200, 3, 100],
  );
  assert.equal(e.tripEarningStatus(ledger, 't2'), 'pending');
  assert.equal(e.tripEarningStatus(ledger, 'nope'), '');
  assert.deepEqual(e.mapWallet(undefined), e.EMPTY_WALLET);
  assert.equal(e.mapLedgerEntry('legacy', { driverId: 'd', amount: 5 }), null);
});
