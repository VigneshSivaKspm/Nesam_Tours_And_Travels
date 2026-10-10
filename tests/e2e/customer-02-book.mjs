// Customer app: accept terms → Booking home → Choose your ride → Review & book → booked.
import { adminDb, open, pause, shot, signIn, tokens } from './lib.mjs';

const db = adminDb();
const { browser, page, errors } = await open('http://127.0.0.1:8099/');
await signIn(page, tokens().cust1);
await pause(3000);
if (await page.getByText(/accept to continue|Accept and continue/i).first().isVisible().catch(() => false)) {
  await page.getByRole('checkbox').first().click();
  await page.getByText('Accept and continue').click();
}
await page.getByText('Plan your next journey').waitFor({ timeout: 20000 });
const acc = await db.collection('legal_acceptances').where('userId', '==', 'cust1').get();
console.log('legal acceptances stored:', acc.size, acc.docs.map((d) => `${d.data().key} v${d.data().version}`));
await pause(4000); // GPS pickup + reverse geocode
await shot(page, 'customer-home');

// Find a Cab without a destination → inline message, no navigation.
await page.getByText('Find a Cab').click();
await pause(500);
await shot(page, 'customer-home-no-destination');

// Destination: search "Madurai Airport" through the Airport tile.
await page.getByRole('button', { name: 'Airport' }).click();
await pause(800);
await shot(page, 'customer-airport-search');
await browser.close();
console.log('errors:', errors.slice(0, 10));
