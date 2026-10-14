// wall contacts and tunnelling in the continuous RL figure: node tools/rlwalls.js themes/figures.js [batches]
const fs = require('fs'); global.window = global; global.document = { documentElement: {}, createElement: () => ({ style: {} }), body: { appendChild() {} } };
eval(fs.readFileSync(process.argv[2], 'utf8'));
const F = TufaFigures.F.rlcont, NB = +(process.argv[3] || 80), out = [];
for (const seed of [11, 23, 47, 71, 93, 101, 131, 151, 177, 199]) {
  let sd = seed; const rand = () => () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const st = F.init({ x: 640, y: 0, w: 512, h: 408, fx: 728, vy0: 14, vy1: 378 }, rand); st.todo = 1e9;
  let steps = 0, contacts = 0, tunnels = 0, hits = 0, first = -1, back = 0, moves = 0; const upd = F.update;
  F.update = (s2) => { const h = s2.agents.filter((a) => a.traj[a.traj.length - 1].r > 0.5).length; if (first < 0 && h >= 12) first = s2.batch; if (s2.batch >= NB - 5) hits += h; upd(s2); };
  const g = 0.012, near = (x, y) => st.walls.some(([x0, y0, x1, y1]) => x > x0 - g && x < x1 + g && y > y0 - g && y < y1 + g);
  while (st.batch < NB && steps < 80000) {
    const prev = st.agents, before = prev.map((a) => [a.x, a.y]); F.step(st); steps++; if (st.agents !== prev) continue;   // a new batch: agents were reset, not moved
    st.agents.forEach((a, i) => { if (!before[i] || a.traj.length === 0) return; const [x0, y0] = before[i]; if (st.batch >= NB - 10 && near(a.x, a.y)) contacts++; if (st.batch >= NB - 10) { moves++; const d0 = Math.hypot(st.goal[0] - x0, st.goal[1] - y0), d1 = Math.hypot(st.goal[0] - a.x, st.goal[1] - a.y); if (a.traj.length < 15 && d1 > d0 + 1e-4 && (a.x < 0.03 || a.x > 0.97 || a.y < 0.03 || a.y > 0.97)) back++; }
      for (let q = 1; q < 10; q++) { const x = x0 + ((a.x - x0) * q) / 10, y = y0 + ((a.y - y0) * q) / 10; if (F.blocked(st, x, y)) { tunnels++; break; } } });
  }
  F.update = upd; out.push(`${Math.round((hits / 120) * 100)}%@${first} c${contacts} t${tunnels} b${back}`);
}
console.log(`goal rate (last 5) @ first-half-batch · wall contacts in the last 10 batches · tunnelling steps · early moves away from the goal along the arena edge (b):\n${out.join('  ')}`);
