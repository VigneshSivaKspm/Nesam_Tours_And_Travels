// Refreshes the emulator sign-in tokens (custom tokens expire after an hour).
//   node tests/e2e/tokens.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../functions/package.json'));
const admin = require('firebase-admin');
process.env.GCLOUD_PROJECT ||= 'demo-nesam';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
if (!process.env.GCLOUD_PROJECT.startsWith('demo-')) throw new Error('Refusing to mint tokens for a non-demo project.');
if (!admin.apps.length) admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const tokens = {};
for (const uid of ['ops', 'cust1', 'drvA']) tokens[uid] = await admin.auth().createCustomToken(uid);
writeFileSync(join(here, '.tokens.json'), JSON.stringify(tokens, null, 2));
console.log('Tokens written to tests/e2e/.tokens.json (valid for one hour)');
process.exit(0);
