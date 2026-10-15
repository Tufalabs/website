// Count drawing calls and time per frame for the chip figure across zoom levels: node tools/chipbench.js themes/figures.js
const fs = require('fs'); let calls = 0;
const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'measureText' ? () => ({ width: 10 }) : () => { calls++; }), set: (o, k, v) => { o[k] = v; return true; } });
global.window = global; global.document = { documentElement: {}, createElement: () => ({ style: {} }), body: { appendChild() {} } };
global.getComputedStyle = () => ({ getPropertyValue: () => 'monospace' });
eval(fs.readFileSync(process.argv[2], 'utf8'));
const F = TufaFigures.F, R = { x: 640, y: 0, w: 512, h: 288, fx: 728, vy0: 44, vy1: 232 }, st = F.chip.init(R);
st.tgt = F.chip.target(st, 14, 18); const C = { ink: '#000', ink2: '#333', ink3: '#666', bg: '#fff' };
for (const z of [1, 3, 10, 40, 150, 600, 3000, 20000, 150000, 400000]) {
  st.z = z; const w = Math.max(0, Math.min(1, Math.log(z / 1.3) / Math.log(30))), e = w * w * (3 - 2 * w); st.cx = 50 + (st.tgt[0] - 50) * e; st.cy = 32 + (st.tgt[1] - 32) * e; calls = 0;
  const t0 = process.hrtime.bigint(); F.chip.draw(ctx, R, 1, C, st, false); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`z ${String(z).padStart(6)}: ${String(calls).padStart(7)} draw calls, ${ms.toFixed(1)} ms`);
}
