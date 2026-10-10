// Customer app: Theni → Bodinayakanur, review & book with UPI and a note, then check the booking record.
import { adminDb, open, pause, shot, signIn, tokens } from './lib.mjs';

const db = adminDb();
const before = new Set((await db.collection('bookings').where('customerId', '==', 'cust1').get()).docs.map((d) => d.id));
const { browser, page, errors } = await open('http://127.0.0.1:8099/');
await signIn(page, tokens().cust1);
await page.getByText('Plan your next journey').waitFor({ timeout: 20000 });
await pause(3000);
await page.getByRole('button', { name: /^Destination/ }).click();
await page.getByRole('textbox').fill('Bodinayakanur');
const hit = page.getByRole('button', { name: /Bodinayakanur/i }).first();
await hit.waitFor({ timeout: 20000 });
await hit.click();
await page.getByRole('button', { name: 'Round Trip' }).click();
await page.getByText('Find a Cab').click();
await page.getByText('Choose your ride').waitFor({ timeout: 10000 });
await pause(5000);
await shot(page, 'customer-choose-ride-round-trip');
await page.getByText('Continue').click();
await page.getByText('Review & book').waitFor({ timeout: 10000 });
await pause(800);
await shot(page, 'customer-review');
await page.getByRole('radio', { name: /UPI/ }).click();
await page.getByLabel('Note for the driver').fill('Gate 2, near the temple');
// An invalid email shows the field error and blocks booking.
await page.getByLabel(/Email/).fill('priya@');
await pause(300);
await page.mouse.wheel(0, 3000);
await pause(300);
await shot(page, 'customer-review-invalid-email');
await page.getByLabel(/Email/).fill('');
await page.getByText(/^Book ride$/).click();
await page.waitForFunction(() => document.body.innerText.includes('Your ride') || document.body.innerText.includes('NESAM is reviewing'), null, { timeout: 30000 });
await pause(1500);
await shot(page, 'customer-ride-after-booking');
const created = (await db.collection('bookings').where('customerId', '==', 'cust1').get()).docs.filter((d) => !before.has(d.id));
for (const d of created) {
  const b = d.data();
  console.log('booking', d.id, { status: b.status, tripType: b.tripType, vehicle: b.vehicleCategory, fare: b.fare, paymentMethod: b.paymentMethod, notes: b.notes, whatsapp: b.customerWhatsapp, email: b.customerEmail, fareLines: b.fareBreakup?.lines?.length, pickupAt: b.pickupAt?.toDate?.(), time: b.time });
}
console.log('errors:', errors.slice(0, 10));
await browser.close();
