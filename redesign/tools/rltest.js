// learning test for the continuous RL figure over random environments: node tools/rltest.js themes/figures.js [alpha] [batches] [ego]
const fs = require('fs'); global.window = global; global.document = { documentElement: {}, createElement: () => ({ style: {} }), body: { appendChild() {} } };
eval(fs.readFileSync(process.argv[2], 'utf8'));
const F = TufaFigures.F, alpha = +(process.argv[3] || F.rlcont.ALPHA), NB = +(process.argv[4] || 80); F.rlcont.ALPHA = alpha; if (process.argv[5]) F.rlcont.EGO = +process.argv[5];
const out = [];
for (const seed of [11, 23, 47, 71, 93, 101, 131, 151, 177, 199]) {
  let sd = seed; const rand = () => () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const st = F.rlcont.init({ x: 640, y: 0, w: 512, h: 288, fx: 728, vy0: 14, vy1: 258 }, rand); st.todo = 1e9;
  let hits = 0, first = -1; const upd = F.rlcont.update;
  F.rlcont.update = (s2) => { const h = s2.agents.filter((a) => a.traj[a.traj.length - 1].r > 0.5).length; if (first < 0 && h >= 12) first = s2.batch; if (s2.batch >= NB - 5) hits += h; upd(s2); };
  let steps = 0; while (st.batch < NB && steps < 60000) { F.rlcont.step(st); steps++; } F.rlcont.update = upd;
  out.push(`${Math.round((hits / (5 * 24)) * 100)}%@${first}`);
}
console.log(`alpha ${alpha}, ${NB} batches · goal rate in the last 5 batches @ first batch with half: ${out.join(' ')}`);
