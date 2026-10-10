// Shared helpers for the browser checks (headless Chrome via playwright-core).
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SHOTS = join(here, 'shots');
mkdirSync(SHOTS, { recursive: true });

export const tokens = () => JSON.parse(readFileSync(join(here, '.tokens.json'), 'utf8'));

export const MOBILE = { width: 390, height: 844 };
export const DESKTOP = { width: 1366, height: 900 };
/** Theni bus stand — the seeded customer's area. */
export const THENI = { latitude: 10.0104, longitude: 77.4768 };

export async function open(url, { viewport = MOBILE, geolocation = THENI, camera = false } = {}) {
  // camera: Chrome's built-in fake camera (a test pattern) for live-capture screens.
  const args = camera ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] : [];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args });
  const context = await browser.newContext({ viewport, geolocation, permissions: camera ? ['geolocation', 'camera'] : ['geolocation'], locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { browser, context, page, errors };
}

/** Signs in with an emulator custom token through the app's test hook. */
export async function signIn(page, token) {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.waitForFunction(() => typeof globalThis.__nesamTestSignIn === 'function', null, { timeout: 30000 });
      await page.evaluate((t) => globalThis.__nesamTestSignIn(t), token);
      return;
      // An expired token rejects here; run tests/e2e/tokens.mjs to refresh.
    } catch (err) {
      // The dev server may reload the page once while it starts; retry after it settles.
      if (attempt >= 2) throw err;
      await page.waitForLoadState('domcontentloaded');
    }
  }
}

let n = 0;
export async function shot(page, name) {
  const file = join(SHOTS, `${String(++n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('shot', file);
  return file;
}

export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Direct reads of the emulator database, to check what an action stored.
import { createRequire } from 'node:module';
let _db = null;
export function adminDb() {
  if (_db) return _db;
  process.env.GCLOUD_PROJECT ||= 'demo-nesam';
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
  const require = createRequire(join(here, '../../functions/package.json'));
  const admin = require('firebase-admin');
  if (!admin.apps.length) admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  _db = admin.firestore();
  return _db;
}
