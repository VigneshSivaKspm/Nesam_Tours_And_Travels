// Driver web (phone width): the assigned trip, in the required order
//   Reached Pickup Location → (boarding OTP + vehicle photos) → Trip Started → Trip Ended
// checking what each step stored, and that steps can't be skipped.
import { adminDb, open, pause, shot, signIn, tokens } from './lib.mjs';

const db = adminDb();
const snap = (await db.collection('bookings').where('assignedDriverId', '==', 'drvA').get()).docs.find((d) => ['Assigned', 'Ongoing'].includes(d.data().status));
if (!snap) throw new Error('Run admin-01-approve-assign.mjs first: no trip assigned to drvA.');
const id = snap.id;
const b0 = snap.data();
const booking = async () => (await db.doc(`bookings/${id}`).get()).data();
console.log('trip under test', id, b0.bookingId, b0.status, b0.tripSubStatus);

// The driver stands at the pickup point.
const { browser, page, errors } = await open('http://127.0.0.1:5176/', { geolocation: { latitude: b0.pickupLat, longitude: b0.pickupLng }, camera: true });
await signIn(page, tokens().drvA);
await pause(4000);
if (await page.getByText(/accept to continue|Accept and continue/i).first().isVisible().catch(() => false)) {
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: /Accept/ }).click();
  await pause(2500);
}
await shot(page, 'driver-dashboard');
await page.getByRole('button', { name: 'Open Trip' }).click();
await pause(1500);
await shot(page, 'driver-trip-go-to-pickup');
console.log('Trip Started visible before pickup?', await page.getByRole('button', { name: 'Trip Started' }).isVisible().catch(() => false));

let b = await booking();
if (b.tripSubStatus === 'Not Started') {
await page.getByRole('button', { name: 'Reached Pickup Location' }).click();
await page.getByText('Start the trip').first().waitFor({ timeout: 20000 });
b = await booking();
console.log('after Reached Pickup:', { status: b.status, sub: b.tripSubStatus, stage: b.tripStage, reachedPickupAt: !!b.reachedPickupAt, located: !!b.reachedPickupLocation });
await shot(page, 'driver-at-pickup');
console.log('Trip Started enabled before OTP/photos?', await page.getByRole('button', { name: 'Trip Started' }).isEnabled());
}

// Wrong OTP, then the customer's real one.
if (!b.boardingVerifiedAt) {
const otp = (await db.doc(`booking_secrets/${id}`).get()).data().otp;
await page.getByLabel('Boarding OTP').fill(otp === '0000' ? '1111' : '0000');
await page.getByRole('button', { name: 'Verify OTP' }).click();
await pause(1500);
await shot(page, 'driver-wrong-otp');
await page.getByLabel('Boarding OTP').fill(otp);
await page.getByRole('button', { name: 'Verify OTP' }).click();
await pause(2000);
await pause(1500);
console.log('boarding verified:', !!(await booking()).boardingVerifiedAt);
}

// Vehicle photos with the (fake) live camera.
if ((await db.doc(`vehicle_verifications/${id}`).get()).data()?.status !== 'Submitted') {
await page.getByRole('button', { name: 'Take vehicle photos' }).click();
await pause(800);
await page.getByRole('checkbox').first().check();
await page.getByRole('button', { name: 'Start verification' }).click();
for (let i = 0; i < 3; i++) {
  await page.getByRole('button', { name: 'Capture photo' }).waitFor({ timeout: 20000 });
  await pause(1500);
  if (i === 0) await shot(page, 'driver-camera');
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await page.getByRole('button', { name: /Use this photo/ }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('Checking…'), null, { timeout: 60000 });
  await pause(1500);
  const alert = await page.getByRole('alert').first().innerText().catch(() => '');
  if (alert) { await shot(page, 'driver-photo-error'); throw new Error('photo step ' + (i + 1) + ': ' + alert); }
}
await page.getByPlaceholder('e.g. 48210').fill('48210');
await shot(page, 'driver-photos-done');
await page.getByRole('button', { name: /Submit verification/ }).click();
await pause(4000);
const v = (await db.doc(`vehicle_verifications/${id}`).get()).data();
}
const vv = (await db.doc(`vehicle_verifications/${id}`).get()).data();
console.log('verification:', { status: vv?.status, risk: vv?.riskLevel, flagged: vv?.flagged, odometer: vv?.odometerReading, slots: Object.keys(vv?.photos ?? {}), signals: Object.values(vv?.photos ?? {}).flatMap((p) => (p.signals ?? []).map((x) => x.code)) });
await shot(page, 'driver-ready-to-start');

await page.getByRole('button', { name: 'Trip Started' }).click();
await page.getByText('Ending Odometer').waitFor({ timeout: 20000 });
b = await booking();
console.log('after Trip Started:', { status: b.status, sub: b.tripSubStatus, stage: b.tripStage, startedAt: !!b.tripStartedAt, startOdometer: b.startOdometer });
await shot(page, 'driver-trip-started');

await page.locator('input[type=number]').first().fill('48300');
await page.getByRole('button', { name: 'Trip End' }).click();
await pause(4000);
b = await booking();
console.log('after Trip End:', { status: b.status, sub: b.tripSubStatus, endOdometer: b.endOdometer, completedAt: !!b.completedAt });
await shot(page, 'driver-after-trip-end');
const events = (await db.collection(`bookings/${id}/events`).get()).docs.map((d) => d.data().type);
console.log('events:', events);
console.log('customer notifications:', (await db.collection('notifications').where('bookingId', '==', id).where('recipientType', '==', 'customer').get()).docs.map((d) => d.data().title));
console.log('errors:', errors.slice(0, 10));
await browser.close();
