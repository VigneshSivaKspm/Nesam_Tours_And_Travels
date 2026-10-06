// Shared set-up for the workflow tests: the compiled Cloud Functions run against
// the Firestore emulator with routing, provider and Storage calls replaced by
// deterministic fakes. Nothing here changes what the functions do — only what
// they talk to.
import { createRequire } from 'node:module';
import jpeg from '../../functions/node_modules/jpeg-js/index.js';

export const PROJECT = process.env.TEST_PROJECT || 'demo-nesam-workflow';
process.env.GCLOUD_PROJECT = PROJECT;
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${process.env.FIRESTORE_EMULATOR_PORT || 8089}`;
// Channel credentials the functions read from the environment.
process.env.OTP_PEPPER = 'test-pepper-0123456789abcdef';
process.env.WHATSAPP_ACCESS_TOKEN = 'wa-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = '12345';
process.env.WHATSAPP_TEMPLATE_OTP = 'nesam_otp';
process.env.WHATSAPP_TEMPLATE_BOOKING_UPDATE = 'nesam_update';
process.env.SMS_PROVIDER = 'twilio';
process.env.TWILIO_ACCOUNT_SID = 'AC123';
process.env.TWILIO_AUTH_TOKEN = 'tok';
process.env.TWILIO_FROM = '+15005550006';
process.env.SENDGRID_API_KEY = 'SG.test';
process.env.EMAIL_FROM = 'noreply@nesam.test';

// ── Fake Storage (vehicle photos) ───────────────────────────────────────────
const fnRequire = createRequire(new URL('../../functions/package.json', import.meta.url));
export const objects = new Map();
export function putObject(path, buffer, metadata = {}, contentType = 'image/jpeg', createdAt = new Date()) {
  objects.set(path, { buffer, metadata, contentType, createdAt });
}
const storagePath = fnRequire.resolve('firebase-admin/storage');
fnRequire.cache[storagePath] = {
  id: storagePath, filename: storagePath, loaded: true, children: [], paths: [],
  exports: {
    getStorage: () => ({
      bucket: () => ({
        file: (path) => ({
          exists: async () => [objects.has(path)],
          getMetadata: async () => {
            const o = objects.get(path);
            return [{ size: o.buffer.length, contentType: o.contentType, timeCreated: o.createdAt.toISOString(), metadata: o.metadata }];
          },
          download: async () => [objects.get(path).buffer],
          delete: async () => { objects.delete(path); },
        }),
      }),
    }),
  },
};

// ── Fake network: routing and the three message providers ──────────────────
export const sent = { whatsapp: [], sms: [], email: [] };
export const failing = new Set(); // 'whatsapp' | 'sms' | 'email'
export const ROUTE = { distance: 10000, duration: 1200 };
const realFetch = globalThis.fetch;
export function installFakeNetwork() {
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => 'msg-id' } });
    if (u.includes('router.project-osrm.org')) return json({ code: 'Ok', routes: [ROUTE] });
    if (u.includes('graph.facebook.com')) {
      if (failing.has('whatsapp')) return json({ error: { message: 'bad number' } }, 400);
      sent.whatsapp.push(JSON.parse(init.body));
      return json({ messages: [{ id: `wamid.${sent.whatsapp.length}` }] });
    }
    if (u.includes('api.twilio.com')) {
      if (failing.has('sms')) return json({ message: 'unreachable' }, 400);
      sent.sms.push(String(init.body));
      return json({ sid: `SM${sent.sms.length}` }, 201);
    }
    if (u.includes('api.sendgrid.com')) {
      if (failing.has('email')) return json({ errors: [] }, 400);
      sent.email.push(JSON.parse(init.body));
      return { ok: true, status: 202, json: async () => ({}), text: async () => '', headers: { get: () => 'sg-1' } };
    }
    return realFetch(url, init);
  };
}
export function restoreNetwork() { globalThis.fetch = realFetch; }
export function resetSent() { sent.whatsapp.length = 0; sent.sms.length = 0; sent.email.length = 0; failing.clear(); }

// ── Calling the functions like the client does ──────────────────────────────
export const asUser = (uid, token = {}) => ({ uid, token: { email: `${uid}@nesam.test`, ...token } });
/** handler.run({auth,data}) — resolves with the function's result or rejects with its HttpsError. */
export const call = (handler, uid, data = {}) => handler.run({ auth: uid ? asUser(uid) : undefined, data });

// ── Images ──────────────────────────────────────────────────────────────────
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
/** A noisy, distinct JPEG (≈100 KB) per seed — enough pixels to pass the size and analysis checks. */
export function makeJpeg(seed, w = 400, h = 300) {
  const r = rng(seed);
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const base = 40 + Math.floor((i % w) / w * 120);
    data[i * 4] = Math.min(255, base + Math.floor(r() * 90));
    data[i * 4 + 1] = Math.min(255, base + Math.floor(r() * 90));
    data[i * 4 + 2] = Math.min(255, base + Math.floor(r() * 90));
    data[i * 4 + 3] = 255;
  }
  return jpeg.encode({ data, width: w, height: h }, 92).data;
}

export const rupeesFromFare = (taxable) => taxable + Math.round(taxable * 0.05);
