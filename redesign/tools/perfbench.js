// Init and per-frame cost of the page figures in heavy states: node tools/perfbench.js themes/figures.js
const fs = require('fs'); let calls = 0;
const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => { calls++; }), set: (o, k, v) => { o[k] = v; return true; } });
global.window = global; global.document = { documentElement: {}, createElement: () => ({ style: {} }), body: { appendChild() {} } };
global.getComputedStyle = () => ({ getPropertyValue: () => 'monospace' }); global.performance = global.performance || { now: () => Date.now() };
eval(fs.readFileSync(process.argv[2], 'utf8'));
const F = TufaFigures.F, C = { ink: '#000', ink2: '#333', ink3: '#666', bg: '#fff', hair: '#999', accent: '#f00' };
const R = { x: 640, y: 0, w: 560, h: 300, fx: 730, fadeFrom: 650, fadeTo: 746, vy0: 14, vy1: 270 };
let sd = 7; const rand = () => () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
const time = (f) => { const t0 = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t0) / 1e6; };
const bench = (name, prep) => {
  const fig = F[name]; let st; const ti = time(() => { st = fig.init(R, rand); });
  if (prep) prep(st, fig);
  const ms = []; let t = 10; for (let i = 0; i < 60; i++) { calls = 0; t += 1 / 60; ms.push(time(() => fig.draw(ctx, R, t, C, st, false, rand))); }
  ms.sort((a, b) => a - b);
  console.log(`${name.padEnd(9)} init ${ti.toFixed(1).padStart(6)} ms · frame median ${ms[30].toFixed(2).padStart(6)} ms, p95 ${ms[57].toFixed(2).padStart(6)} ms · ${calls} draw calls`);
};
bench('descent'); bench('fold');
bench('scaling2', (st, f) => { st.slide = 1; for (let i = 0; i < 400; i++) f.start(st, true, 7.5 + (i % 46) * 0.1, 8.5 + Math.floor(i / 46) * 0.5); });
bench('rlcont', (st) => { st.todo = 1e9; });
bench('attnpat', (st) => { st.since = null; });
bench('chip', (st) => { st.z = 40; });
