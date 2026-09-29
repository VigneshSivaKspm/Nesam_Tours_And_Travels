// Starts the Firestore emulator (unless one is already listening), runs the
// rules suite, and stops what it started.
//
//   cd tests/firestore-rules && npm install && npm test
//
// Uses the emulator jar that firebase-tools caches under
// ~/.cache/firebase/emulators (install once with: firebase setup:emulators:firestore).
// Override with FIRESTORE_EMULATOR_JAR=/path/to/cloud-firestore-emulator.jar.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HOST = '127.0.0.1';
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8089);

function listening() {
  return new Promise((resolve) => {
    const s = connect(PORT, HOST);
    s.once('connect', () => {
      s.end();
      resolve(true);
    });
    s.once('error', () => resolve(false));
  });
}

function findJar() {
  if (process.env.FIRESTORE_EMULATOR_JAR) return process.env.FIRESTORE_EMULATOR_JAR;
  const dir = join(homedir(), '.cache', 'firebase', 'emulators');
  if (!existsSync(dir)) return null;
  const jar = readdirSync(dir).filter((f) => /^cloud-firestore-emulator-.*\.jar$/.test(f)).sort().pop();
  return jar ? join(dir, jar) : null;
}

let emulator = null;
if (!(await listening())) {
  const jar = findJar();
  if (!jar) {
    console.error('Firestore emulator jar not found. Run `firebase setup:emulators:firestore` or set FIRESTORE_EMULATOR_JAR.');
    process.exit(2);
  }
  emulator = spawn('java', ['-jar', jar, '--host', HOST, '--port', String(PORT)], { stdio: 'ignore' });
  // Up to 2 minutes: the JVM starts slowly while Android builds are running.
  for (let i = 0; i < 240 && !(await listening()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await listening())) {
    emulator.kill();
    console.error('Firestore emulator did not start.');
    process.exit(2);
  }
}

const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...process.argv.slice(2), 'rules.test.mjs', 'server.test.mjs', 'marketplace.test.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, FIRESTORE_EMULATOR_PORT: String(PORT) },
});
const code = await new Promise((resolve) => child.on('exit', resolve));
emulator?.kill();
process.exit(code ?? 1);
