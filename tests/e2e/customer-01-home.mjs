// Customer app: sign in, accept the published terms, land on Booking home.
import { open, pause, shot, signIn, tokens } from './lib.mjs';

const { browser, page, errors } = await open('http://127.0.0.1:8099/');
await pause(4000);
await shot(page, 'customer-signed-out');
await signIn(page, tokens().cust1);
await pause(5000);
await shot(page, 'customer-after-signin');
console.log('errors:', errors.slice(0, 15));
await browser.close();
