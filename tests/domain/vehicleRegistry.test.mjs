// Vehicle auto-detection (spec page 13/2): registration normalising, provider
// record mapping, category suggestion and the provider call — all offline.
// Run after `cd functions && npm run build`: `node --test tests/domain`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const reg = require('../../functions/lib/domain/vehicleRegistry.js');
const lookup = require('../../functions/lib/vehicleLookup.js');
const onboarding = require('../../functions/lib/vendorOnboarding.js');

const crysta = {
  success: true,
  status_code: 200,
  data: {
    rc_number: 'TN01AB1234', owner_name: 'RAVI KUMAR', maker_description: 'TOYOTA KIRLOSKAR MOTOR PVT LTD', maker_model: 'INNOVA CRYSTA 2.4 GX',
    fuel_type: 'DIESEL', seat_capacity: '8', color: 'WHITE', manufacturing_date_formatted: '2021-06', vehicle_category: 'LMV', vehicle_category_description: 'Motor Cab(LMV)',
    rc_status: 'ACTIVE', fit_up_to: '2027-06-30', insurance_upto: '2026-12-31', permit_valid_upto: '31-Mar-2027', tax_upto: 'LTT', pucc_upto: '2026-11-02',
    registered_at: 'CHENNAI (CENTRAL)', owner_mobile: '9999999999', present_address: '1 Secret Street',
  },
};

test('registration numbers are normalised and validated', () => {
  assert.equal(reg.normalizeRegistration(' tn 01-ab.1234 '), 'TN01AB1234');
  assert.equal(reg.spacedRegistration('tn01ab1234'), 'TN 01 AB 1234');
  assert.deepEqual(reg.registrationVariants('TN 01 AB 1234'), ['TN01AB1234', 'TN 01 AB 1234', 'TN-01-AB-1234']);
  for (const ok of ['TN01AB1234', 'TN 09 AX 0001', 'KA03MA1234', 'DL1CAB1234', '22BH1234AA']) assert.ok(reg.isValidRegistration(ok), ok);
  for (const bad of ['', 'NOTAPLATE', '12345', 'TN', 'TN01', 'TN0112', null, 42]) assert.ok(!reg.isValidRegistration(bad), String(bad));
});

test('dates from a register are converted; lifetime tax and junk are not guessed', () => {
  assert.equal(reg.toIsoDate('2027-03-31'), '2027-03-31');
  assert.equal(reg.toIsoDate('31-03-2027'), '2027-03-31');
  assert.equal(reg.toIsoDate('31/03/2027'), '2027-03-31');
  assert.equal(reg.toIsoDate('31-Mar-2027'), '2027-03-31');
  assert.equal(reg.toIsoDate('LTT'), '');
  assert.equal(reg.toIsoDate('31-02-2027'), '');
  assert.equal(reg.toIsoDate(null), '');
});

test('a document is valid through its expiry day (Indian calendar)', () => {
  assert.equal(reg.isExpired('2026-10-13', '2026-10-13'), false);
  assert.equal(reg.isExpired('2026-10-12', '2026-10-13'), true);
  assert.equal(reg.isExpired('', '2026-10-13'), false);
  // 18:45 UTC on 12 Oct is already 13 Oct, 00:15 in India.
  assert.equal(reg.indiaToday(new Date('2026-10-12T18:45:00Z')), '2026-10-13');
});

test('an Innova Crysta record maps to the Crysta class with 7+1 seating', () => {
  const r = reg.mapProviderRecord(crysta, 'TN01AB1234');
  assert.equal(r.registrationNumber, 'TN01AB1234');
  assert.equal(r.make, 'Toyota Kirloskar Motor Pvt Ltd');
  assert.equal(r.model, 'Innova Crysta 2.4 Gx');
  assert.equal(r.fuelType, 'Diesel');
  assert.equal(r.seatingCapacity, 8);
  assert.equal(r.passengerSeats, 7);
  assert.equal(r.seatClass, '7+1');
  assert.equal(r.manufactureYear, '2021');
  assert.equal(r.colour, 'White');
  assert.equal(r.usage, 'commercial');
  assert.equal(r.registrationActive, true);
  assert.equal(r.specClass, 'Crysta');
  assert.equal(r.category, 'Premium SUV');
  assert.deepEqual(r.validity, { fitnessUpto: '2027-06-30', insuranceUpto: '2026-12-31', permitUpto: '2027-03-31', taxUpto: '', pucUpto: '2026-11-02' });
});

test('personal data is not carried into the mapped record', () => {
  const r = reg.mapProviderRecord(crysta, 'TN01AB1234');
  assert.equal(r.ownerNameMasked, 'R••• K•••');
  const flat = JSON.stringify(r);
  assert.ok(!/RAVI|KUMAR|9999999999|Secret Street/i.test(flat));
});

test('categories follow passenger seats, never the marketing name alone', () => {
  const cat = (model, make, seats) => reg.detectCategory(model, make, seats);
  assert.deepEqual(cat('Dzire', 'Maruti', 5), { category: 'Sedan', specClass: 'Sedan' });
  assert.deepEqual(cat('Swift', 'Maruti', 5), { category: 'Hatchback', specClass: 'Sedan' });
  assert.deepEqual(cat('Ertiga', 'Maruti', 7), { category: 'SUV', specClass: 'SUV' });
  assert.deepEqual(cat('Innova', 'Toyota', 8), { category: 'SUV', specClass: 'Innova' });
  assert.deepEqual(cat('Innova Crysta', 'Toyota', 7), { category: 'Premium SUV', specClass: 'Crysta' });
  assert.deepEqual(cat('Traveller', 'Force', 13), { category: 'Tempo Traveller', specClass: 'Tempo Traveller' });
  // A 5-seat compact SUV cannot serve an SUV 6+1 duty.
  assert.deepEqual(cat('Creta', 'Hyundai', 5), { category: 'Sedan', specClass: 'Sedan' });
});

test('private and transport classes are told apart; a bare "Motor Car" is not guessed', () => {
  const m = (cls, desc = '') => reg.mapProviderRecord({ rc_number: 'TN01AB1234', maker_model: 'Dzire', vehicle_category: cls, vehicle_category_description: desc }).usage;
  assert.equal(m('LMV', 'Motor Cab(LMV)'), 'commercial');
  assert.equal(m('LMV', 'Non-Transport'), 'private');
  assert.equal(m('Motor Car(LMV)'), 'unknown');
  assert.equal(m('', ''), 'unknown');
});

test('register problems become reviewer issues', () => {
  const r = reg.mapProviderRecord({ rc_number: 'TN01AB1234', maker_model: 'Dzire', rc_status: 'CANCELLED', insurance_upto: '2026-01-01', fit_up_to: '2026-12-01', seat_capacity: '5', vehicle_category_description: 'Non-Transport' });
  const codes = reg.vehicleIssues(r, '2026-10-13').map((i) => i.code).sort();
  assert.deepEqual(codes, ['insurance_expired', 'not_commercial', 'registration_inactive']);
  const clean = reg.mapProviderRecord(crysta, 'TN01AB1234');
  assert.deepEqual(reg.vehicleIssues(clean, '2026-10-13'), []);
});

test('a payload without a vehicle is "not found", not an empty vehicle', () => {
  assert.equal(reg.mapProviderRecord({ success: false, message: 'No record found' }), null);
  assert.equal(reg.mapProviderRecord(null), null);
  assert.equal(reg.mapProviderRecord({ data: {} }), null);
});

test('provider configuration comes only from the environment', () => {
  assert.equal(reg.providerConfigFromEnv({}), null);
  assert.equal(reg.providerConfigFromEnv({ VEHICLE_LOOKUP_PROVIDER: 'surepass' }), null);
  assert.equal(reg.providerConfigFromEnv({ VEHICLE_LOOKUP_PROVIDER: 'custom', VEHICLE_LOOKUP_API_KEY: 'k' }), null);
  assert.equal(reg.providerConfigFromEnv({ VEHICLE_LOOKUP_PROVIDER: 'custom', VEHICLE_LOOKUP_API_KEY: 'k', VEHICLE_LOOKUP_API_URL: 'http://insecure.example' }), null);
  const c = reg.providerConfigFromEnv({ VEHICLE_LOOKUP_PROVIDER: 'surepass', VEHICLE_LOOKUP_API_KEY: 'k' });
  assert.equal(c.url, 'https://kyc-api.surepass.io/api/v1/rc/rc-full');
  assert.equal(c.authHeader, 'Authorization');
  assert.equal(c.idField, 'id_number');
});

const cfg = { url: 'https://provider.example/rc', apiKey: 'secret', authHeader: 'Authorization', idField: 'id_number', provider: 'surepass' };
const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('the provider call sends the key as a bearer token and maps a found vehicle', async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => crysta }; };
  const r = await lookup.queryProvider(cfg, 'TN01AB1234', fetchImpl);
  assert.equal(r.status, 'found');
  assert.equal(seen.init.headers.Authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(seen.init.body), { id_number: 'TN01AB1234' });
});

test('a custom header carries the key verbatim', async () => {
  let headers;
  const fetchImpl = async (_u, init) => { headers = init.headers; return { ok: true, status: 200, json: async () => crysta }; };
  await lookup.queryProvider({ ...cfg, authHeader: 'x-api-key' }, 'TN01AB1234', fetchImpl);
  assert.equal(headers['x-api-key'], 'secret');
  assert.equal(headers.Authorization, undefined);
});

test('provider outcomes: unknown plate, rejected key, outage', async () => {
  assert.equal((await lookup.queryProvider(cfg, 'TN01AB1234', reply(422, { message: 'No record found' }))).status, 'not_found');
  assert.equal((await lookup.queryProvider(cfg, 'TN01AB1234', reply(404, {}))).status, 'not_found');
  assert.equal((await lookup.queryProvider(cfg, 'TN01AB1234', reply(200, { data: {} }))).status, 'not_found');
  assert.equal((await lookup.queryProvider(cfg, 'TN01AB1234', reply(401, { message: 'bad key' }))).status, 'unavailable');
  assert.equal((await lookup.queryProvider(cfg, 'TN01AB1234', reply(503, {}))).status, 'unavailable');
  const down = async () => { throw new Error('ECONNRESET'); };
  assert.equal((await lookup.queryProvider(cfg, 'TN01AB1234', down)).status, 'unavailable');
});

test('invitation tokens: bare code or pasted link, stored only as a hash', () => {
  const code = 'abcDEF1234567890_-abcdefghij';
  assert.equal(onboarding.tokenFromInput(code), code);
  assert.equal(onboarding.tokenFromInput(`https://vendor.example.com/?invite=${code}`), code);
  assert.equal(onboarding.tokenFromInput('short'), '');
  assert.equal(onboarding.tokenFromInput(null), '');
  const h = onboarding.hashInvitationToken(code);
  assert.match(h, /^[a-f0-9]{64}$/);
  assert.notEqual(h, code);
});
