// Admin panel (desktop): log in → dashboard → Bookings tabs → approve the customer's
// pending booking → assign the driver; the database is checked after each action.
import { adminDb, DESKTOP, MOBILE, open, pause, shot } from './lib.mjs';

const db = adminDb();
const pending = (await db.collection('bookings').where('customerId', '==', 'cust1').get()).docs.find((d) => ['Pending', 'Approved'].includes(d.data().status));
if (!pending) throw new Error('Run customer-04-confirm.mjs first: no Pending/Approved booking.');
const needsApproval = pending.data().status === 'Pending';
const code = pending.data().bookingId;
console.log('booking under test', pending.id, code);

const { browser, page, errors } = await open('http://127.0.0.1:5175/', { viewport: DESKTOP });
await page.getByPlaceholder('admin@nesam.in').fill('ops@nesam.test');
await page.getByPlaceholder('••••••••').fill('Test@12345');
await page.locator('button[type=submit]').click();
await page.getByText('Create New Booking').first().waitFor({ timeout: 20000 });
await pause(2500);
await shot(page, 'admin-dashboard');

await page.getByRole('button', { name: 'All Bookings' }).first().click();
await pause(1500);
await shot(page, 'admin-bookings-pending');
const row = page.locator('tr', { hasText: code });
if (needsApproval) {
await row.getByRole('button', { name: 'Approve' }).click();
await pause(500);
await shot(page, 'admin-approve-dialog');
await page.getByRole('button', { name: 'Approve', exact: true }).last().click();
await page.waitForFunction(() => !document.body.innerText.includes('Approve booking'), null, { timeout: 20000 });
await pause(1500);
var b = (await db.doc(`bookings/${pending.id}`).get()).data();
const offer = (await db.doc(`marketplace_trips/${pending.id}`).get()).data();
console.log('after approve:', { status: b.status, approvedBy: b.approvedBy, marketplace: offer?.status, offeredPayout: offer?.offeredPayout });
}

await page.getByRole('tab', { name: /^Approved/ }).first().click();
await pause(1000);
await shot(page, 'admin-bookings-approved');
await page.locator('tr', { hasText: code }).getByRole('button', { name: 'Assign driver' }).click();
await pause(800);
await page.locator('[role=dialog] select, .fixed select').filter({ has: page.locator('option[value=drvA]') }).first().selectOption('drvA');
await pause(500);
await shot(page, 'admin-assign-dialog');
await page.getByRole('button', { name: 'Assign driver', exact: true }).last().click();
await page.waitForFunction(() => !document.body.innerText.includes('Review the change'), null, { timeout: 20000 });
await pause(1500);
b = (await db.doc(`bookings/${pending.id}`).get()).data();
const history = await db.collection(`bookings/${pending.id}/assignment_history`).get().catch(() => null);
console.log('after assign:', { status: b.status, driver: b.assignedDriverId, driverName: b.assignedDriverName, vehicle: b.assignedVehicleNumber, payout: b.driverPayout, history: history?.size });
const notes = (await db.collection('notifications').where('bookingId', '==', pending.id).get()).docs.map((d) => `${d.data().recipientType}:${d.data().title}`);
console.log('notifications:', notes);
await page.getByRole('tab', { name: /^Confirmed/ }).first().click().catch(() => undefined);
await pause(1000);
await shot(page, 'admin-bookings-after-assign');

// Same page at phone width.
await page.setViewportSize(MOBILE);
await pause(800);
await shot(page, 'admin-bookings-mobile');
console.log('errors:', errors.slice(0, 10));
await browser.close();
