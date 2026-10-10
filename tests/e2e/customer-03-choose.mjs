// Customer app: pick an airport destination → Choose your ride → fare details.
import { open, pause, shot, signIn, tokens } from './lib.mjs';

const { browser, page, errors } = await open('http://127.0.0.1:8099/');
await signIn(page, tokens().cust1);
await page.getByText('Plan your next journey').waitFor({ timeout: 20000 });
await pause(3000);
await page.getByRole('button', { name: 'Airport' }).click();
// Results from the place-search service (Photon); airports are tagged by the app.
const result = page.getByRole('button', { name: /Madurai.*Airport|Airport.*Madurai/i }).first();
await result.waitFor({ timeout: 20000 }).catch(async () => {
  await shot(page, 'customer-airport-results-missing');
  throw new Error('no airport result');
});
await shot(page, 'customer-airport-results');
await result.click();
await pause(800);
// Scroll the home screen to show saved places and support.
await page.mouse.wheel(0, 2000);
await pause(500);
await shot(page, 'customer-home-with-destination-scrolled');
await page.getByText('Find a Cab').click();
await page.getByText('Choose your ride').waitFor({ timeout: 10000 });
await pause(5000); // route (OSRM) + quotes
await shot(page, 'customer-choose-ride');
await page.getByText('SUV', { exact: true }).click();
await page.getByText('Fare details').click();
await pause(500);
await page.mouse.wheel(0, 3000);
await pause(500);
await shot(page, 'customer-choose-ride-suv-fare-details');
await browser.close();
console.log('errors:', errors.slice(0, 10));
