// Figure harness: mount a figure (themes/figures.js) with a stubbed DOM and canvas, interact, and print one
// character per sample: M = the frame changed, s = redrawn identically, . = no frame. Usage:
//   node tools/harness.js themes/figures.js <figure> '[["down",0.5,0.5],["up",0.5,0.5]]'
// Pointer coordinates are fractions of the visible figure area (x) and the band (y).
const fs = require('fs');
let hash = 0, ops = 0;
const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? (s) => ({ width: String(s).length * 6 }) : (...a) => { ops++; for (const v of a) if (typeof v === 'number') hash = (hash * 31 + Math.round(v * 10)) | 0; }), set: (o, k, v) => { o[k] = v; return true; } });
const el = () => ({ style: {}, classList: { contains: () => false, add() {} }, appendChild() {}, setAttribute() {} });
global.document = { documentElement: el(), createElement: el, body: el(), fonts: null };
global.getComputedStyle = () => ({ color: 'rgb(0,0,0)', getPropertyValue: () => 'monospace' });
global.matchMedia = () => ({ matches: false }); global.devicePixelRatio = 1; global.addEventListener = () => {};
global.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 33); global.cancelAnimationFrame = (id) => clearTimeout(id);
global.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() { this.cb([{ isIntersecting: true }]); } };
global.MutationObserver = class { observe() {} }; global.window = global;
eval(fs.readFileSync(process.argv[2], 'utf8'));
const name = process.argv[3], W = 1200, H = 288, col = (W - 264) / 12, c8 = 7 * (col + 24), c7 = 6 * (col + 24);
const canvas = { getContext: () => ctx, style: {}, getBoundingClientRect: () => ({ width: W, height: H }), parentNode: el() };
const fig = TufaFigures.mount(canvas, name, () => ({ x: c7, y: 0, w: W - c7, h: H, fx: c8, vy0: 44, vy1: H - 56 }), { staticUntilTouched: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sample = async (n, ms) => { let out = '', prev = hash, po = ops; for (let i = 0; i < n; i++) { await sleep(ms); out += ops !== po ? (hash !== prev ? 'M' : 's') : '.'; prev = hash; po = ops; } return out; };
(async () => {
  await sleep(200);
  console.log(name.padEnd(10), 'rest ', await sample(6, 200));
  const acts = JSON.parse(process.argv[4] || '[["down",0.6,0.3]]');
  fig.touch();
  for (const [t, fx, fy] of acts) { fig.pointer(t, c8 + fx * (W - c8), fy * H, t === 'up' ? 0 : 1); await sleep(30); }
  console.log(name.padEnd(10), 'after', await sample(36, 250));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
