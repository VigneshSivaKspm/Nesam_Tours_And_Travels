// Customer app: My Trips tabs, trip details, Account, Payment history, Privacy & terms.
import { open, pause, shot, signIn, tokens } from './lib.mjs';

const { browser, page, errors } = await open('http://127.0.0.1:8099/');
await signIn(page, tokens().cust1);
await page.getByText('Plan your next journey').waitFor({ timeout: 20000 });
// If a live (pending) ride opens automatically on launch, go back to the tabs.
if (await page.getByText('Booking under review').isVisible().catch(() => false)) {
  await shot(page, 'customer-launch-with-live-ride');
  await page.getByRole('link', { name: /back/i }).click();
  await pause(800);
}
await page.getByRole('tab', { name: 'My Trips' }).click();
await page.getByText('Your journeys, organised').waitFor();
await pause(1500);
await shot(page, 'customer-trips-upcoming');
await page.getByRole('tab', { name: /^Completed/ }).click();
await pause(500);
await shot(page, 'customer-trips-completed');
await page.getByRole('tab', { name: /^Upcoming/ }).click();
await pause(500);
if (await page.getByRole('button', { name: /View details for/ }).first().isVisible().catch(() => false)) {
  await page.getByRole('button', { name: /View details for/ }).first().click();
  await pause(1500);
  await shot(page, 'customer-trip-details');
  await page.getByRole('link', { name: /back/i }).click();
} else {
  await page.getByRole('tab', { name: /^Completed/ }).click();
  await pause(500);
  if (await page.getByRole('button', { name: /View receipt/i }).first().isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /View receipt/i }).first().click();
    await pause(1500);
    await shot(page, 'customer-trip-receipt');
    await page.getByRole('link', { name: /back/i }).click();
    await pause(800);
  }
}
await page.getByRole('tab', { name: 'Account' }).click();
await page.getByText('My Account').waitFor();
await pause(800);
await shot(page, 'customer-account');
await page.mouse.wheel(0, 2000);
await pause(400);
await shot(page, 'customer-account-scrolled');
await page.getByRole('button', { name: 'Payment history' }).click();
await pause(1000);
await shot(page, 'customer-payment-history');
await page.getByRole('link', { name: /back/i }).click();
await pause(500);
await page.getByRole('button', { name: 'Privacy & terms' }).click();
await page.getByText(/Version 1/).first().waitFor({ timeout: 15000 });
await page.getByText('Read').first().click();
await pause(500);
await shot(page, 'customer-privacy-terms');
console.log('errors:', errors.slice(0, 10));
await browser.close();
