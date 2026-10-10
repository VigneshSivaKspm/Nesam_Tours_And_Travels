// Generates the three notification tones as small WAV files (no audio assets to license):
//   new_booking — bright rising three-note chime
//   approval    — soft major arpeggio (confirmation)
//   general     — one short mellow ping
// Usage: node tools/generate-notification-sounds.cjs
// Writes <app>/assets/sounds/{new_booking,approval,general}.wav for each Expo app.
const fs = require('fs');
const path = require('path');

const RATE = 22050;

function tone(samples, freq, start, dur, shape, gain) {
  const from = Math.floor(start * RATE);
  const n = Math.floor(dur * RATE);
  for (let i = 0; i < n && from + i < samples.length; i++) {
    const t = i / RATE;
    const phase = 2 * Math.PI * freq * t;
    const wave = shape === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
    const attack = Math.min(1, t / 0.015);
    const release = Math.pow(1 - i / n, 2);
    samples[from + i] += wave * gain * attack * release;
  }
}

const PATTERNS = {
  new_booking: { length: 0.75, build: (s) => { tone(s, 784, 0, 0.18, 'triangle', 0.5); tone(s, 1175, 0.16, 0.18, 'triangle', 0.5); tone(s, 1568, 0.32, 0.4, 'triangle', 0.45); } },
  approval: { length: 0.8, build: (s) => { [523, 659, 784, 1047].forEach((f, i) => tone(s, f, i * 0.11, 0.32, 'sine', 0.4)); } },
  general: { length: 0.4, build: (s) => { tone(s, 880, 0, 0.3, 'sine', 0.45); } },
};

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767, i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const root = path.join(__dirname, '..');
for (const app of ['driver/app', 'vendor/app', 'user/app']) {
  const dir = path.join(root, app, 'assets', 'sounds');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, p] of Object.entries(PATTERNS)) {
    const samples = new Float32Array(Math.floor(p.length * RATE));
    p.build(samples);
    fs.writeFileSync(path.join(dir, `${name}.wav`), wav(samples));
  }
  console.log('wrote', dir);
}
