var tauMs = (v) => { v = String(v).trim(); const n = parseFloat(v); return isNaN(n) ? 120 : /ms$/.test(v) || !/s$/.test(v) ? n : n * 1000; };   // the beat in ms ("120ms", or ".12s" after minifying)
// Calm generative figures about intelligence. Each figure draws into a region R of a 2-D context.
// Rules: few marks, slow change, mostly still at any moment, muted inks, the accent on at most one
// mark, no text. Each run is seeded fresh. API: init(R, rand) -> state; draw(ctx, R, t, C, s, still).
(() => {
    const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    // the one curve: the page's --ease (a cubic-bezier), evaluated here so canvas motion matches CSS motion
    let EASE = [0.65, 0, 0.35, 1];
    const bez = (x) => { const [x1, y1, x2, y2] = EASE, B = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t; let lo = 0, hi = 1, t = x; for (let i = 0; i < 16; i++) { const v = B(t, x1, x2); if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; } return B(t, y1, y2); };
    const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : bez(x));
    const TAU = Math.PI * 2;
    const dot = (ctx, x, y, r, c, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
    const line = (ctx, x0, y0, x1, y1, c, a = 1, w = 1) => { ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
    const noise = (seed) => { const h = (i) => { const x = Math.sin(i * 127.1 + seed) * 43758.5453; return x - Math.floor(x); }; return (x) => { const i = Math.floor(x), f = x - i; return h(i) + (h(i + 1) - h(i)) * ease(f); }; };

    // The shared language (from the gradient-descent study):
    //   fields  — dot screens and dotted contours in ink-3
    //   paths   — drawn strokes, faint at their start, firmer toward the head, turning to accent at the end
    //   focus   — one soft accent blur, smeared back along its direction of travel
    const glow = (ctx, C, x, y, trail = [], a = 1) => {
        const pts = [...trail, [x, y]], n = pts.length;
        pts.forEach(([px, py], j) => {
            const k = (j + 1) / n, rad = 3 + 4.5 * k;
            const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
            g.addColorStop(0, C.accent); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = a * (n > 1 ? 0.16 * k : 0.32); ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill();
        });
    };
    const stroke = (ctx, C, pts, a = 1, tail = 0.15) => {
        if (pts.length < 2) return;
        ctx.lineCap = 'round'; ctx.lineWidth = 1.1;
        for (let i = 1; i < pts.length; i++) {
            const rel = i / (pts.length - 1), hot = rel > 1 - tail;
            ctx.globalAlpha = a * (hot ? 0.35 + 0.45 * (rel - (1 - tail)) / tail : 0.1 + 0.5 * rel * rel);
            ctx.strokeStyle = hot ? C.accent : C.ink2;
            ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
        }
    };
    const stipple = (ctx, C, x, y, w, h, a = 1) => {            // a cell drawn as a 3×3 dot screen
        ctx.fillStyle = C.ink2;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { ctx.globalAlpha = a; ctx.fillRect(x + (i + 0.5) * (w / 3) - 0.75, y + (j + 0.5) * (h / 3) - 0.75, 1.5, 1.5); }
    };

    const F = {};
    // how much of the machine a figure may use: at most half its cores for workers; a worker that trains for long works
    // in slices with rests on smaller machines (all of a core from 8 cores, 70% from 4, else half); a low-end device
    // (2 cores or fewer, or 2 GB of memory or less) skips optional work
    const DEVICE = (() => { const nav = typeof navigator === 'undefined' ? {} : navigator, cores = nav.hardwareConcurrency || 2, mem = nav.deviceMemory || 8;
        // speed: a fixed loop of float arithmetic, the best of six runs (the first ones run before the code is optimised),
        // about 0.25 ms on a recent laptop; k its time relative to that
        let k = 1; try { const a = new Float32Array(256); let best = 1e9, s = 0; for (let n = 0; n < 6; n++) { const t0 = performance.now(); for (let r = 0; r < 400; r++) for (let i = 0; i < 256; i++) { a[i] = a[i] * 0.99 + i; s += a[i]; } best = Math.min(best, performance.now() - t0); } k = s < 0 ? 1 : Math.max(0.5, best / 0.25); } catch (e) { k = 1; }
        const slow = k > 3, crawl = k > 8;
        return { k, workers: Math.max(1, Math.min(slow ? 2 : 4, Math.floor(cores / 2))), duty: crawl ? 0.35 : slow ? 0.5 : cores >= 8 ? 1 : cores >= 4 ? 0.7 : 0.5, low: cores <= 2 || mem <= 2 || crawl }; })();
    // work that can wait starts when the browser is idle (never competing with the page loading)
    const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));

    // A feed-forward network: dotted connections; one signal travels as a soft glow
    F.mlp = {
        title: 'Feed-forward network', note: 'Layers of units; now and then one signal travels from input to output.',
        init(R) {
            const sizes = [4, 6, 6, 3];
            return { layers: sizes.map((n, l) => Array.from({ length: n }, (_, i) => ({ x: R.x + (l / (sizes.length - 1)) * R.w, y: R.y + ((i + 1) / (n + 1)) * R.h }))) };
        },
        draw(ctx, R, t, C, s, still, rand) {
            const { layers } = s;
            ctx.fillStyle = C.ink3;
            for (let l = 0; l < layers.length - 1; l++) for (const a of layers[l]) for (const b of layers[l + 1]) {
                const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.floor(d / 7);
                for (let i = 1; i < n; i++) { ctx.globalAlpha = 0.18; ctx.fillRect(a.x + (b.x - a.x) * i / n - 0.5, a.y + (b.y - a.y) * i / n - 0.5, 1, 1); }
            }
            layers.flat().forEach((u) => dot(ctx, u.x, u.y, 2, C.ink3, 0.7));
            const P = 7, n = Math.floor(t / P), p = still ? 0.55 : (t % P) / P, r = rand(n);
            const path = layers.map((L) => L[Math.floor(r() * L.length)]);
            const k = (1 - Math.pow(1 - Math.min(1, p / 0.7), 2)) * (layers.length - 1), fade = still ? 1 : 1 - ease((p - 0.8) / 0.2);
            const pos = (u) => { const l = Math.min(path.length - 2, Math.floor(u)), f = Math.min(1, u - l); return [path[l].x + (path[l + 1].x - path[l].x) * f, path[l].y + (path[l + 1].y - path[l].y) * f]; };
            const pts = []; for (let u = 0; u <= k; u += 0.04) pts.push(pos(u)); pts.push(pos(k));
            stroke(ctx, C, pts, fade);
            const [hx, hy] = pos(k), trail = [0.18, 0.12, 0.06].map((d) => pos(Math.max(0, k - d)));
            glow(ctx, C, hx, hy, trail, fade);
        },
    };

    // Embedding space: points in drifting clusters; a probe glides between them
    F.embedding = {
        bleed: true,
        title: 'Embedding space', note: 'Points in slowly drifting clusters; a probe glides from one concept to another.',
        init(R, rand) { const r = rand(1); return { pts: Array.from({ length: 42 }, (_, i) => ({ c: i % 3, ox: (r() - 0.5) * 2, oy: (r() - 0.5) * 2 })), nz: noise(r() * 1000) }; },
        draw(ctx, R, t, C, s, still) {
            const T = still ? 3 : t * 0.04, fx = R.fx ?? R.x, fw = R.x + R.w - fx;
            const centers = [0, 1, 2].map((c) => ({ x: fx + fw * (0.15 + 0.7 * s.nz(T + c * 10)), y: R.y + R.h * (0.2 + 0.6 * s.nz(T + c * 10 + 5)) }));
            s.pts.forEach((q) => { const c = centers[q.c]; dot(ctx, c.x + q.ox * 24, c.y + q.oy * 16, 1.3, C.ink3, 0.6); });
            const P = 9, u = still ? 0.6 : (t % P) / P, a = Math.floor(t / P) % 3, b = (a + 1) % 3, e = ease(u / 0.8);
            const at = (v) => [centers[a].x + (centers[b].x - centers[a].x) * v, centers[a].y + (centers[b].y - centers[a].y) * v];
            const [hx, hy] = at(e), trail = [0.12, 0.08, 0.04].map((d) => at(Math.max(0, e - d * (1 - e))));
            glow(ctx, C, hx, hy, trail);
        },
    };

    // Associative memory: a stored pattern as dot screens, corrupted then recalled; the updating cell glows
    F.hopfield = {
        title: 'Associative memory', note: 'A Hopfield network: a stored pattern is corrupted, then recalled one cell at a time.',
        init: () => ({}),
        draw(ctx, R, t, C, s, still, rand) {
            const P = 11, n = Math.floor(t / P), p = still ? 0.85 : (t % P) / P, r = rand(n), Cx = 8, Cy = 6;
            const mem = Array.from({ length: Cx * Cy }, (_, i) => { const x = i % Cx, y = Math.floor(i / Cx); return ((x + y) % 4 === 0 && r() < 0.8) || r() < 0.08 ? 1 : 0; });
            const flips = mem.map((_, i) => [r(), i]).sort((a, b) => a[0] - b[0]).slice(0, Math.floor(Cx * Cy * 0.3)).map((e) => e[1]);
            const corrupt = ease(p / 0.25), recall = ease((p - 0.35) / 0.45), cur = Math.floor(recall * flips.length);
            const pitch = Math.min(16, Math.floor(Math.min(R.w / Cx, R.h / Cy))), x0 = R.x + (R.w - Cx * pitch) / 2, y0 = R.y + (R.h - Cy * pitch) / 2;
            let focus = null;
            mem.forEach((v, i) => {
                const k = flips.indexOf(i), flipped = !still && k >= 0 && (k / flips.length < corrupt) && k >= cur;
                const on = flipped ? 1 - v : v, x = x0 + (i % Cx) * pitch, y = y0 + Math.floor(i / Cx) * pitch;
                ctx.globalAlpha = 0.45; ctx.fillStyle = C.ink3; ctx.fillRect(x + pitch / 2 - 0.5, y + pitch / 2 - 0.5, 1, 1);
                if (on) stipple(ctx, C, x + 1, y + 1, pitch - 2, pitch - 2, 0.65);
                if (!still && p > 0.35 && p < 0.8 && k === cur) focus = [x + pitch / 2, y + pitch / 2];
            });
            if (focus) glow(ctx, C, focus[0], focus[1]);
        },
    };

    // ── point scenes: the shared engine ───────────────────────────────────────────────────────────
    // A figure is a sequence of scenes. Each scene is a fixed-size field of points [x, y, alpha] (in a
    // stable order, so point i of one scene pairs with point i of the next) plus named lines, each a
    // list of points. Between scenes the field glides as a wave along its order; lines assemble from
    // the nearest field points, start to end, and dissolve back into the field at the next scene.
    const hilbert = (x, y, n = 64) => { let d = 0; for (let s2 = n / 2; s2 > 0; s2 = Math.floor(s2 / 2)) { const rx = (x & s2) > 0 ? 1 : 0, ry = (y & s2) > 0 ? 1 : 0; d += s2 * s2 * ((3 * rx) ^ ry); if (!ry) { if (rx) { x = s2 - 1 - x; y = s2 - 1 - y; } [x, y] = [y, x]; } } return d; };
    const scenes = (spec) => ({
        bleed: spec.bleed, title: spec.title, note: spec.note,
        init: () => ({ n: -1 }),
        prepare(s, R) {
            const { field } = s.cur;
            s.cur.home = {}; s.cur.line = {};
            Object.entries(spec.lines).forEach(([key, cfg], o) => {
                let q = s.cur.lines[key] || [];
                if (cfg.spacing && q.length > 1) {                                  // resample by arc length
                    const cum = [0]; for (let i = 1; i < q.length; i++) cum.push(cum[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]));
                    const len = cum[cum.length - 1], k = Math.max(2, Math.min(cfg.K, Math.round(len / cfg.spacing)));
                    const at = (d) => { let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const u = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); return [q[i - 1][0] + (q[i][0] - q[i - 1][0]) * u, q[i - 1][1] + (q[i][1] - q[i - 1][1]) * u]; };
                    q = Array.from({ length: k }, (_, j) => at((j / (k - 1)) * len));
                } else q = q.slice(0, cfg.K);
                s.cur.line[key] = q;
                s.cur.home[key] = Array.from({ length: cfg.K }, (_, j) => {
                    if (j >= q.length) return field[(j * 37 + o * 101) % field.length];
                    let best = 0, bd = Infinity; const [lx, ly] = q[j];
                    for (let i = 0; i < field.length; i += 2) { const d = (field[i][0] - lx) ** 2 + (field[i][1] - ly) ** 2; if (d < bd) { bd = d; best = i; } }
                    return field[best];
                });
            });
        },
        pointer: spec.pointer,
        draw(ctx, R, t, C, s, still, rand) {
            const P = spec.period, T = t + (spec.offset || 0);
            if (s.k == null) { s.k = 0; s.sceneStart = 0; }
            // the reader asked for a new scene: it plays `quick` times faster, then the figure carries on at its own pace
            if (s.force) { s.force = false; s.k += 1; s.sceneStart = T; s.rate = s.touched ? spec.quick || 1 : 1; s.wake = P / s.rate + 0.4; }
            else if (!still && !s.hold && (T - s.sceneStart) * (s.rate || 1) >= P) { s.k += 1; s.sceneStart = T; s.rate = 1; }
            const n = s.k, p = still ? 0.95 : Math.min(1, ((T - s.sceneStart) * (s.rate || 1)) / P);
            if (s.n !== n) {
                if (s.cur) {
                    s.prev = s.cur.field;
                    s.prevLine = Object.fromEntries(Object.keys(spec.lines).map((key) => [key, s.cur.home[key].map((h, j) => s.cur.line[key][j] || h)]));
                    s.prevK = Object.fromEntries(Object.keys(spec.lines).map((key) => [key, s.cur.line[key].length]));
                }
                const first = !s.cur;
                s.still = still; s.cur = spec.build(R, rand(n * 3 + 1), n, s); s.n = n;
                F.__scenes.prepare.call(null, s, R, spec);
                if (first && !still) {
                    // on page open each point starts a few pixels from its place, invisible, and fades in as it settles:
                    // mostly fade, little movement
                    const r0 = rand(424242), near = ([x, y]) => [x + (r0() - 0.5) * 10, y + (r0() - 0.5) * 10, 0];
                    s.prev = s.cur.field.map(near);
                    s.prevLine = Object.fromEntries(Object.keys(spec.lines).map((key) => [key, s.cur.home[key].map(near)]));
                    s.prevK = null; s.opening = true;
                } else s.opening = false;
            }
            // scene changes use the figure's timing (fractions of the scene); the page-open fade uses fixed
            // seconds, so every figure appears within about 1.5s whatever its scene length
            const [ST, DU] = spec.morph || [0.14, 0.24], EASE = spec.ease || smooth, N = s.cur.field.length, secs = t;
            const wave = (i, count) => (still || !s.prev ? 1 : s.opening ? smooth((secs - 0.5 * (i / count)) / 1.0) : EASE((p - ST * (i / count)) / DU));
            const lineStart = s.opening ? 1.3 / P : 0.18;
            // ambient drift: every point breathes on slow sine waves with its own phase (about ±1px)
            const AMP = still ? 0 : spec.drift ?? 0.9;
            const dx = (i) => AMP * Math.sin(t * 0.55 + i * 1.731), dy = (i) => AMP * Math.cos(t * 0.47 + i * 2.377);
            ctx.fillStyle = C.ink3;
            s.cur.field.forEach(([x, y, a = 1, d = 1], i) => {
                const [px, py, pa = a] = (s.prev && s.prev[i]) || [x, y, s.prev ? 0 : a], m = wave(i, N);
                ctx.globalAlpha = 0.55 * (pa + (a - pa) * m); if (ctx.globalAlpha < 0.01) return;
                // points with a larger drift wander further and faster (noise, observations)
                const ox = d === 1 ? dx(i) : d * AMP * (Math.sin(t * 0.9 * Math.sqrt(d) + i * 1.731) + 0.5 * Math.sin(t * 1.7 + i * 0.37)) / 1.5;
                const oy = d === 1 ? dy(i) : d * AMP * (Math.cos(t * 0.8 * Math.sqrt(d) + i * 2.377) + 0.5 * Math.cos(t * 1.9 + i * 0.53)) / 1.5;
                ctx.fillRect(px + (x - px) * m - 0.6 + ox, py + (y - py) * m - 0.6 + oy, 1.2, 1.2);
            });
            if (!s.hideLines) Object.entries(spec.lines).forEach(([key, cfg]) => {
                const [size, alpha, delay] = cfg.style, line = s.cur.line[key], home = s.cur.home[key], k = line.length;
                const from = s.prevLine ? s.prevLine[key] : home, wasOn = s.prevK ? s.prevK[key] : 0, K = cfg.K;
                const color = cfg.color ? cfg.color(C) : (s.touched ? C.accent : C.ink);
                for (let j = 0; j < K; j++) {
                    const h = home[j], f0 = from[j] || h, m = wave(j, K);
                    let x = f0[0] + (h[0] - f0[0]) * m, y = f0[1] + (h[1] - f0[1]) * m, u = 0;
                    if (j < k) { u = still ? 1 : smooth((p - lineStart - delay - (cfg.sweep ?? 0.25) * (j / k)) / 0.2); x += (line[j][0] - x) * u; y += (line[j][1] - y) * u; }
                    const leaving = !still && j < wasOn ? 1 - smooth(p / 0.2) : 0, w = Math.max(u, leaving);
                    x += 0.6 * dx(j + 7919); y += 0.6 * dy(j + 7919);
                    if (w < 1 && (j < k || j < wasOn)) { ctx.globalAlpha = 0.55 * (1 - w) * (s.opening ? m : 1); ctx.fillStyle = C.ink3; ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2); }
                    // an optional soft pulse travels along the line, so assembled lines stay alive
                    const pulse = cfg.pulse && !still ? 0.6 + 0.4 * (0.5 + 0.5 * Math.sin((j / Math.max(1, k)) * TAU * 1.5 - t * cfg.pulse)) : 1;
                    if (w > 0) { ctx.globalAlpha = alpha * w * pulse; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, (size / 2) * (0.6 + 0.4 * w), 0, TAU); ctx.fill(); }
                }
            });
            if (spec.decorate) spec.decorate(ctx, R, C, s, p, still, t);
        },
    });
    F.__scenes = { prepare: (s, R, spec) => scenes(spec).prepare(s, R) };

    // Optimizers on one loss surface, run as written in their papers. The parameters θ = (u, v) live in the panel's own
    // units (its width is 1), and the loss is a sum of Gaussian valleys, f(θ) = −Σ aᵢ exp(−|θ − cᵢ|²/sᵢ²), with its
    // exact gradient. Every optimizer starts at the same point, takes the same number of steps with its published
    // defaults and one fixed learning rate (OPT), and nothing else touches its iterates but the panel's edges (a box
    // projection). Gradient descent and heavy-ball momentum (Polyak 1964); RMSprop (Hinton 2012, ρ = 0.9); Adam
    // (Kingma & Ba 2014, β = 0.9, 0.999, ε = 10⁻⁸, bias-corrected); Muon (Jordan et al. 2024: Nesterov momentum 0.95,
    // then five quintic Newton–Schulz steps; for a 1×2 parameter the orthogonalised update is its unit direction, so
    // here Muon is normalised Nesterov momentum); Gauss–Newton in a trust region (Powell's dogleg), on the residuals
    // rᵢ = √(2aᵢ(1 − Eᵢ)), Eᵢ = exp(−|θ − cᵢ|²/sᵢ²), since f = ½Σrᵢ² − Σaᵢ. The path is the iterates themselves; hovering one
    // names its optimizer, settings and loss. Drag the start or a valley: the runs follow live, and on release they race,
    // one step per beat for all.
    F.descent = {
        bleed: true, STEPS: 160,
        // name, label, line kind, size step (u/2, u, 2u); Adam (the cited paper) is the 2u line in focus tone
        NAMES: [['gd', 'Gradient descent', 'dotted', -1], ['muon', 'Muon', 'dotted', 0], ['rmsprop', 'RMSprop', 'dotted', 1],
            ['momentum', 'Momentum', 'line', -1], ['gn', 'Gauss–Newton', 'line', 0], ['adam', 'Adam', 'line', 1]],
        // the one learning rate each (in panel widths), and its other settings, as printed on hover
        OPT: { gd: { lr: 0.012 }, momentum: { lr: 0.006, mu: 0.9 }, rmsprop: { lr: 0.006, rho: 0.9, eps: 1e-8 },
            adam: { lr: 0.006, b1: 0.9, b2: 0.999, eps: 1e-8 }, muon: { lr: 0.012, mu: 0.95 }, gn: { delta: 0.02, max: 0.25 } },
        title: 'Optimizers', note: 'Six optimizers from one start on one loss surface, each as published with one fixed learning rate; drag the start or a valley.',
        init(R, rand) {
            const r = rand(1), fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = R.vy1 ?? R.y + R.h;
            const M = { x: fx, y: vy0, w: R.x + R.w - fx, h: vy1 - vy0 }, H = M.h / M.w;
            // valleys well inside the panel and apart from each other, so each is its own minimum
            const wells = [];
            for (let tries = 0; wells.length < 4 && tries < 400; tries++) {
                const w = { x: 0.15 + 0.7 * r(), y: (0.2 + 0.6 * r()) * H, a: 0.4 + r() * 0.8, s: 0.12 + r() * 0.13 };
                if (wells.every((o) => Math.hypot(o.x - w.x, o.y - w.y) > 0.28)) wells.push(w);
            }
            const st = { wells, M, H, R, runAt: -1 };
            F.descent.surface(st);
            // the start: the highest of a few random points
            let best = -Infinity;
            for (let c = 0; c < 16; c++) { const u = r(), v = (0.1 + 0.8 * r()) * H, f = st.f(u, v); if (f > best) { best = f; st.start = [u, v]; } }
            F.descent.run(st);
            return st;
        },
        P(st, u, v) { return [st.M.x + u * st.M.w, st.M.y + v * st.M.w]; },
        // the loss, its gradient, its minimum (refined from the grid by gradient steps), and its contours as a field of points
        surface(st) {
            const W = st.wells, M = st.M, H = st.H;
            st.f = (u, v) => W.reduce((acc, w) => acc - w.a * Math.exp(-((u - w.x) ** 2 + (v - w.y) ** 2) / (w.s * w.s)), 0);
            st.g = (u, v) => W.reduce(([gu, gv], w) => { const du = u - w.x, dv = v - w.y, k = (2 * w.a * Math.exp(-(du * du + dv * dv) / (w.s * w.s))) / (w.s * w.s); return [gu + k * du, gv + k * dv]; }, [0, 0]);
            let lo = Infinity, hi = -Infinity, at = [0, 0]; const sm = [], step = 3 / M.w, u0 = (st.R.x - M.x) / M.w;
            for (let v = 0; v <= H; v += step) for (let u = u0; u <= 1; u += step) { const f = st.f(u, v); sm.push(u, v, f); if (u >= 0 && f < lo) { lo = f; at = [u, v]; } hi = Math.max(hi, f); }
            for (let i = 0; i < 200; i++) { const [gu, gv] = st.g(...at); at = [at[0] - 0.002 * gu, at[1] - 0.002 * gv]; }
            st.fmin = Math.min(lo, st.f(...at));
            const dots = [];
            // nine levels between the minimum and the plateau; the plateau itself (far from every valley) is not a contour
            for (let i = 0; i < sm.length; i += 3) { const k = ((sm[i + 2] - lo) / (hi - lo)) * 9; if (k > 0.5 && k < 8.9 && k - Math.floor(k) < 0.09) dots.push(...F.descent.P(st, sm[i], sm[i + 1])); }
            st.dots = dots;
        },
        run(st) {
            const { f, g, H, wells } = st, O = F.descent.OPT, N = F.descent.STEPS;
            const box = ([u, v]) => [Math.min(1, Math.max(0, u)), Math.min(H, Math.max(0, v))];
            const go = (update) => { let th = st.start.slice(); const s = {}, path = [th], loss = [f(...th)]; for (let t = 1; t <= N; t++) { const d = update(th, g(...th), s, t); th = box([th[0] + d[0], th[1] + d[1]]); path.push(th); loss.push(f(...th)); } return { path, loss }; };
            st.runs = {
                gd: go((th, [gu, gv]) => [-O.gd.lr * gu, -O.gd.lr * gv]),
                momentum: go((th, [gu, gv], s) => { const { lr, mu } = O.momentum; s.u = mu * (s.u || 0) + gu; s.v = mu * (s.v || 0) + gv; return [-lr * s.u, -lr * s.v]; }),
                rmsprop: go((th, [gu, gv], s) => { const { lr, rho, eps } = O.rmsprop; s.u = rho * (s.u || 0) + (1 - rho) * gu * gu; s.v = rho * (s.v || 0) + (1 - rho) * gv * gv; return [-lr * gu / (Math.sqrt(s.u) + eps), -lr * gv / (Math.sqrt(s.v) + eps)]; }),
                adam: go((th, [gu, gv], s, t) => { const { lr, b1, b2, eps } = O.adam;
                    s.mu = b1 * (s.mu || 0) + (1 - b1) * gu; s.mv = b1 * (s.mv || 0) + (1 - b1) * gv; s.vu = b2 * (s.vu || 0) + (1 - b2) * gu * gu; s.vv = b2 * (s.vv || 0) + (1 - b2) * gv * gv;
                    const c1 = 1 - b1 ** t, c2 = 1 - b2 ** t; return [-lr * (s.mu / c1) / (Math.sqrt(s.vu / c2) + eps), -lr * (s.mv / c1) / (Math.sqrt(s.vv / c2) + eps)]; }),
                // Muon: Nesterov momentum, then the quintic Newton–Schulz iteration X ← aX + b(XXᵀ)X + c(XXᵀ)²X from X/‖X‖
                muon: go((th, [gu, gv], s) => { const { lr, mu } = O.muon; s.u = mu * (s.u || 0) + gu; s.v = mu * (s.v || 0) + gv;
                    let x = gu + mu * s.u, y = gv + mu * s.v; const n = Math.hypot(x, y); if (!n) return [0, 0]; x /= n; y /= n;
                    for (let k = 0; k < 5; k++) { const A = x * x + y * y, c = 3.4445 - 4.775 * A + 2.0315 * A * A; x *= c; y *= c; }
                    return [-lr * x, -lr * y]; }),
                // Gauss–Newton in a trust region (Powell's dogleg, as in Nocedal & Wright): with g = Jᵀr and B = JᵀJ over one
                // residual per valley, the step is the Gauss–Newton step −B⁻¹g if it fits in the radius Δ, else the dogleg path
                // from the steepest-descent (Cauchy) point towards it, cut at Δ. The radius doubles when the quadratic model
                // predicted the loss well (ρ > ¾) at the boundary, shrinks fourfold when it did not (ρ < ¼); a step that raises
                // the loss is refused
                gn: go(([u, v], grad, s) => {
                    let a11 = 0, a12 = 0, a22 = 0, g1 = 0, g2 = 0;
                    wells.forEach((w) => { const du = u - w.x, dv = v - w.y, E = Math.exp(-(du * du + dv * dv) / (w.s * w.s)), ri = Math.sqrt(Math.max(1e-12, 2 * w.a * (1 - E)));
                        const k = (2 * w.a * E) / (w.s * w.s) / ri, ju = k * du, jv = k * dv;   // ∇rᵢ = ∇(½rᵢ²)/rᵢ
                        a11 += ju * ju; a12 += ju * jv; a22 += jv * jv; g1 += ri * ju; g2 += ri * jv; });
                    if (s.delta == null) s.delta = O.gn.delta;
                    const D = s.delta, gn2 = g1 * g1 + g2 * g2; if (gn2 < 1e-24) return [0, 0];
                    const det = a11 * a22 - a12 * a12 || 1e-18, pb = [-(a22 * g1 - a12 * g2) / det, -(a11 * g2 - a12 * g1) / det];
                    const gBg = g1 * (a11 * g1 + a12 * g2) + g2 * (a12 * g1 + a22 * g2), pu = [-(gn2 / gBg) * g1, -(gn2 / gBg) * g2];
                    let p;
                    if (Math.hypot(...pb) <= D) p = pb;
                    else if (Math.hypot(...pu) >= D) { const n = Math.sqrt(gn2); p = [-D * g1 / n, -D * g2 / n]; }
                    else { const d = [pb[0] - pu[0], pb[1] - pu[1]], A = d[0] ** 2 + d[1] ** 2, Bq = 2 * (pu[0] * d[0] + pu[1] * d[1]), Cq = pu[0] ** 2 + pu[1] ** 2 - D * D, tau = (-Bq + Math.sqrt(Bq * Bq - 4 * A * Cq)) / (2 * A); p = [pu[0] + tau * d[0], pu[1] + tau * d[1]]; }
                    const pred = -(g1 * p[0] + g2 * p[1]) - 0.5 * (p[0] * (a11 * p[0] + a12 * p[1]) + p[1] * (a12 * p[0] + a22 * p[1]));
                    const [nu, nv] = box([u + p[0], v + p[1]]), rho = (f(u, v) - f(nu, nv)) / (pred || 1e-18), atEdge = Math.hypot(...p) > 0.99 * D;
                    if (rho < 0.25) s.delta = D / 4; else if (rho > 0.75 && atEdge) s.delta = Math.min(O.gn.max, 2 * D);
                    return rho > 0 ? p : [0, 0]; }),
            };
        },
        // grab the start (or, away from it, the nearest valley); a press elsewhere sets a new start
        pointer(type, x, y, st) {
            const M = st.M, u = (x - M.x) / M.w, v = (y - M.y) / M.w, inM = u >= 0 && u <= 1 && v >= 0 && v <= st.H;
            const [sx, sy] = F.descent.P(st, ...st.start), dStart = Math.hypot(x - sx, y - sy);
            let well = null, bd = Infinity; st.wells.forEach((w) => { const [wx, wy] = F.descent.P(st, w.x, w.y), d = Math.hypot(x - wx, y - wy); if (d < bd) { bd = d; well = w; } });
            const grabWell = bd < 30 && dStart > 10, cl = (q, hi) => Math.min(hi, Math.max(0, q));
            if (type === 'down' && inM) {
                st.drag = grabWell ? { well, du: well.x - u, dv: well.y - v } : { start: true };
                if (!grabWell) st.start = [cl(u, 1), cl(v, st.H)];
                st.runAt = null; st.preview = true;
            } else if (type === 'move' && st.drag) {
                if (st.drag.well) { st.drag.well.x = cl(u + st.drag.du, 1); st.drag.well.y = cl(v + st.drag.dv, st.H); F.descent.surface(st); }
                else st.start = [cl(u, 1), cl(v, st.H)];
            } else if (type === 'up' && st.drag) { st.drag = null; st.preview = false; st.runAt = -2; }
            else if (type === 'leave') st.hoverWell = null;
            if (type !== 'up' && type !== 'leave') st.hoverWell = st.drag ? st.drag.well || null : grabWell ? well : null;
            // the run under the pointer (within 7px of its path), named while hovered
            if (type === 'leave' || st.drag) st.hoverPath = null;
            else if (type === 'move' && st.runs) {
                let best = null, bd2 = 49;
                for (const k in st.runs) st.runs[k].path.forEach((th) => { const [px, py] = F.descent.P(st, ...th), d2 = (px - x) ** 2 + (py - y) ** 2; if (d2 < bd2) { bd2 = d2; best = { k, x: px, y: py }; } });
                if ((best && best.k) !== (st.hoverPath && st.hoverPath.k)) st.wake = 0.3; st.hoverPath = best;
            }
            if (st.drag) { F.descent.run(st); st.wake = 0.5; }
        },
        HELP: { gd: 'η 0.012', momentum: 'η 0.006 · μ 0.9', rmsprop: 'η 0.006 · ρ 0.9', adam: 'η 0.006 · β 0.9, 0.999', muon: 'η 0.012 · μ 0.95, Nesterov', gn: 'trust region, dogleg · Δ from 0.02' },
        draw(ctx, R, t, C, st, still) {
            // the race: every optimizer one step per beat (τ), together
            const N = F.descent.STEPS, BEAT = K.TB / 4;
            if (st.runAt === -2) { st.runAt = t; st.wake = N * BEAT + 0.3; }
            const running = st.runAt >= 0 && !still, k = st.preview ? N : running ? Math.min(N, Math.floor((t - st.runAt) / BEAT)) : N;
            const M = st.M;
            // the surface: its contours as a field of context points, the panel a closed line
            for (let i = 0; i < st.dots.length; i += 2) K.pt(ctx, C, st.dots[i], st.dots[i + 1], -1, 0.25);
            st.wells.forEach((w) => K.pt(ctx, C, ...F.descent.P(st, w.x, w.y), w === st.hoverWell ? 1 : 0, w === st.hoverWell ? 1 : 0.5));
            const hp = st.hoverPath && !st.preview ? st.hoverPath.k : null;
            F.descent.NAMES.forEach(([key, , kind, size]) => {
                const path = st.runs[key].path.slice(0, k + 1).map((th) => F.descent.P(st, ...th));
                let tone = key === 'adam' ? 1 : 0.5; if (hp) tone = key === hp ? 1 : 0.25; if (st.preview) tone = 0.25;
                const sz = st.preview ? -1 : size, draw = kind === 'line' ? K.line : K.dotted;
                draw(ctx, C, path, sz, tone);
                if (!st.preview && k < N) K.pt(ctx, C, ...path[path.length - 1], 1, 1);
            });
            // the start: a ring (two closed lines)
            const [sx, sy] = F.descent.P(st, ...st.start);
            K.line(ctx, C, K.circle(sx, sy, 4 * K.U), 0, 1, true);
            // labels, on hover only
            if (hp) { const run = st.runs[hp]; label(ctx, C, st, `${F.descent.NAMES.find((e) => e[0] === hp)[1]} · ${F.descent.HELP[hp]}`, st.hoverPath.x + 12, st.hoverPath.y - 12, 'left', true);
                label(ctx, C, st, `loss above the minimum ${(run.loss[Math.min(k, N)] - st.fmin).toExponential(1)}`, st.hoverPath.x + 12, st.hoverPath.y, 'left'); }
            label(ctx, C, st, 'start', sx, sy - 12, 'center');
            if (running && k < N) label(ctx, C, st, `step ${k}/${N}`, M.x + M.w, M.y + M.h - K.LN / 4, 'right', true);
            if (st.hover) { const w = st.wells.reduce((a, b) => (b.a > a.a ? b : a)); label(ctx, C, st, 'valley', ...F.descent.P(st, w.x, w.y + 12 / M.w), 'center'); label(ctx, C, st, 'loss surface', M.x + 12, M.y + 6); }
            if (running && k < N) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // Lorenz attractor: the attractor sampled as a point field, turning slowly in 3-D from scene to
    // scene; two trajectories from almost the same start assemble and drift apart
    const lorenz = (x, y, z, steps, dt = 0.006) => { const out = []; for (let i = 0; i < steps; i++) { const dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - (8 / 3) * z; x += dx * dt; y += dy * dt; z += dz * dt; out.push([x, y, z]); } return out; };
    F.attractor = scenes({
        bleed: true, period: 18,
        title: 'Strange attractor', note: 'The Lorenz attractor as a point field, turning slowly; two nearly identical starts diverge.',
        build(R, r, n, s) {
            if (!s.orbit) s.orbit = lorenz(1, 1, 20, 9000).slice(1000);
            const ang = 0.15 + 0.55 * Math.sin(n * 0.8), c = Math.cos(ang), sn = Math.sin(ang);   // sways; never edge-on
            const cx = (R.fx ?? R.x) + (R.x + R.w - (R.fx ?? R.x)) / 2, vy0 = R.vy0 ?? R.y, vh = (R.vy1 ?? R.y + R.h) - vy0;
            const P2 = ([x, y, z]) => [cx + ((x * c + y * sn) / 22) * (R.x + R.w - (R.fx ?? R.x)) * 0.5, vy0 + vh + 6 - ((z - 4) / 44) * (vh + 12)];
            const N = 2400, field = Array.from({ length: N }, (_, i) => [...P2(s.orbit[Math.floor((i / N) * s.orbit.length)]), 1.6]);
            // a second, smaller and fainter view of the same attractor from another angle, set behind and above
            const a2 = ang + 1.4, c2 = Math.cos(a2), s2 = Math.sin(a2), W2 = (R.x + R.w - (R.fx ?? R.x)) * 0.32;
            const Q2 = ([x, y, z]) => [cx - W2 * 0.55 + ((x * c2 + y * s2) / 22) * W2, vy0 + vh * 0.5 - ((z - 25) / 44) * vh * 0.7];
            for (let i = 0; i < 900; i++) field.push([...Q2(s.orbit[Math.floor((i / 900) * s.orbit.length)]), 0.55]);
            const start = s.orbit[Math.floor(r() * (s.orbit.length - 600))];
            const a = lorenz(start[0], start[1], start[2], 300), b = lorenz(start[0] + 0.02, start[1], start[2], 300);
            return { field, lines: { a: a.map(P2), b: b.map(P2) } };
        },
        lines: {
            a: { K: 220, spacing: 2.6, style: [1.8, 0.9, 0.0], sweep: 0.45 },
            b: { K: 220, spacing: 2.6, style: [1.4, 0.4, 0.06], sweep: 0.45 },
        },
    });

    // Flow field: a vector field of swirls and saddles drawn as a lattice of tiny dotted dashes;
    // streamlines traced through it assemble in the accent; the field turns from scene to scene
    F.flow = scenes({
        bleed: true, period: 13,
        title: 'Flow field', note: 'A vector field of swirls and saddles as dotted dashes; streamlines traced through it.',
        build(R, r) {
            const fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vh = (R.vy1 ?? R.y + R.h) - vy0, W = R.x + R.w - fx;
            // sources of rotation and divergence, placed mostly in the visible part
            const C = Array.from({ length: 5 }, () => ({ x: fx + (r() * 1.1 - 0.15) * W, y: vy0 + r() * vh, rot: (r() < 0.5 ? -1 : 1) * (0.6 + r()), div: (r() - 0.5) * 0.8, s: 40 + r() * 70 }));
            const vel = (x, y) => { let vx = 0.35, vy = 0; for (const c of C) { const dx = x - c.x, dy = y - c.y, d2 = dx * dx + dy * dy, k = Math.exp(-d2 / (2 * c.s * c.s)); vx += k * (-dy * c.rot + dx * c.div) / c.s; vy += k * (dx * c.rot + dy * c.div) / c.s; } const m = Math.hypot(vx, vy) || 1; return [vx / m, vy / m, m]; };
            const field = [];
            for (let y = vy0 - 6; y <= vy0 + vh + 6; y += 12) for (let x = R.x; x <= R.x + R.w; x += 12) {
                const [ux, uy, m] = vel(x, y), a = 0.55 + Math.min(0.9, m * 0.6);
                for (let k = -1; k <= 1; k++) field.push([x + ux * k * 2.6, y + uy * k * 2.6, a]);
            }
            const trace = () => {
                let x = fx + r() * W * 0.6, y = vy0 + (0.15 + 0.7 * r()) * vh; const pts = [[x, y]];
                for (let i = 0; i < 260; i++) { const [ux, uy] = vel(x, y); x += ux * 2; y += uy * 2; if (x < fx - 40 || x > R.x + R.w || y < vy0 - 10 || y > vy0 + vh + 10) break; pts.push([x, y]); }
                return pts;
            };
            const stream = () => { let best = []; for (let k = 0; k < 8; k++) { const t2 = trace(); if (t2.length > best.length) best = t2; if (best.length > 150) break; } return best; };
            return { field, lines: { s1: stream(), s2: stream(), s3: stream(), s4: stream() } };
        },
        lines: {
            s1: { K: 240, spacing: 2.2, style: [2.1, 1, 0], sweep: 0.4 }, s2: { K: 240, spacing: 2.2, style: [1.8, 0.7, 0.05], sweep: 0.4 },
            s3: { K: 240, spacing: 2.2, style: [1.6, 0.5, 0.1], sweep: 0.4 }, s4: { K: 240, spacing: 2.2, style: [1.5, 0.4, 0.15], sweep: 0.4 },
        },
    });

    // Learning curves: evaluation points of several training runs as the field; smoothed curves of the
    // runs assemble in the accent, the best run strongest
    F.curves = scenes({
        bleed: true, period: 13,
        title: 'Learning curves', note: 'Evaluation points from several training runs; their smoothed curves converge.',
        build(R, r) {
            const fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vh = (R.vy1 ?? R.y + R.h) - vy0, X = (u) => R.x + u * R.w, Y = (v) => vy0 + (1 - v) * vh;
            const runs = Array.from({ length: 5 }, (_, i) => { const rate = 2 + r() * 5, ceil = 0.55 + r() * 0.4, start = 0.05 + r() * 0.1, nz = noise(r() * 1000); return { f: (u) => start + (ceil - start) * (1 - Math.exp(-rate * u)) + (nz(u * 6) - 0.5) * 0.06, ceil }; }).sort((a, b) => a.ceil - b.ceil);
            const field = [];
            runs.forEach((run) => { for (let i = 0; i < 260; i++) { const u = i / 259; field.push([X(u), Y(run.f(u)) + (r() - 0.5) * 10, 0.9]); } });
            for (let k = 0; k <= 4; k++) for (let i = 0; i < 70; i++) field.push([X(i / 69), Y(k / 4), 0.35]);       // faint gridlines
            const curve = (run) => Array.from({ length: 200 }, (_, i) => { const u = (fx - R.x) / R.w * 0.6 + (i / 199) * (1 - (fx - R.x) / R.w * 0.6); return [X(u), Y(run.f(u))]; });
            return { field, lines: { best: curve(runs[4]), mid: curve(runs[2]), low: curve(runs[0]) } };
        },
        lines: { best: { K: 280, spacing: 2, style: [2.2, 1, 0.1], sweep: 0.4 }, mid: { K: 280, spacing: 2, style: [1.7, 0.6, 0.05], sweep: 0.4 }, low: { K: 280, spacing: 2, style: [1.5, 0.4, 0], sweep: 0.4 } },
    });

    // Stokes flow: creeping viscous flow (left to right) past one to three round obstacles, drawn as
    // point rings. Uses the analytic Stokes solution past a sphere (superposed for several obstacles).
    // Tracer points ride the flow continuously; four streamlines are traced in the accent; obstacles
    // drift and resize slowly from scene to scene, so the flow reshapes without cuts.
    F.stokes = {
        bleed: true,
        title: 'Stokes flow', note: 'Creeping viscous flow past obstacles: tracers ride the flow, streamlines in the accent, obstacles drifting slowly.',
        init: () => ({}),
        draw(ctx, R, t, C, s, still, rand) {
            const fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vh = (R.vy1 ?? R.y + R.h) - vy0, W = R.x + R.w - fx;
            const P = 18, n = Math.floor(t / P), p = still ? 1 : (t % P) / P, e = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, p / 0.8));
            const layout = (k) => { const r = rand(k * 5 + 3), m = 1 + Math.floor(r() * 3); return Array.from({ length: 3 }, (_, i) => i < m ? { x: fx + (0.15 + 0.7 * r()) * W, y: vy0 + (0.2 + 0.6 * r()) * vh, a: 10 + r() * 22 } : { x: fx + W * 0.5, y: vy0 + vh * 0.5, a: 0 }); };
            const A = layout(n - 1), B = layout(n), obs = A.map((o, i) => ({ x: o.x + (B[i].x - o.x) * e, y: o.y + (B[i].y - o.y) * e, a: o.a + (B[i].a - o.a) * e }));
            const U = 26;                                                       // free-stream speed, px per second
            const vel = (x, y) => {
                let ux = U, uy = 0;
                for (const o of obs) {
                    if (o.a < 1) continue;
                    const dx = x - o.x, dy = y - o.y, r = Math.hypot(dx, dy);
                    if (r < o.a) return [0, 0];
                    const c = dx / r, sn = dy / r, ar = o.a / r;
                    const ur = U * c * (1 - 1.5 * ar + 0.5 * ar ** 3), ut = -U * sn * (1 - 0.75 * ar - 0.25 * ar ** 3);
                    ux += ur * c - ut * sn - U; uy += ur * sn + ut * c;             // superpose each obstacle's disturbance
                }
                return [ux, uy];
            };
            // tracers: advected continuously, respawning at the left edge
            if (!s.tr) { const r = rand(77); s.tr = Array.from({ length: 900 }, () => [R.x + r() * R.w, vy0 - 20 + r() * (vh + 40)]); s.last = t; }
            const dt = still ? 0 : Math.min(0.05, t - s.last); s.last = t;
            ctx.fillStyle = C.ink3;
            for (const q of s.tr) {
                const [ux, uy] = vel(q[0], q[1]); q[0] += ux * dt; q[1] += uy * dt;
                const inside = obs.some((o) => o.a > 1 && Math.hypot(q[0] - o.x, q[1] - o.y) < o.a + 1);
                if (q[0] > R.x + R.w || inside) { q[0] = R.x + Math.random() * 20; q[1] = vy0 - 20 + Math.random() * (vh + 40); }
                ctx.globalAlpha = 0.6; ctx.fillRect(q[0] - 0.6, q[1] - 0.6, 1.2, 1.2);
            }
            // obstacles: rings of points
            obs.forEach((o) => { if (o.a < 2) return; const m = Math.max(12, Math.floor(o.a * 1.6)); for (let k = 0; k < m; k++) { const ang = (k / m) * TAU; ctx.globalAlpha = 0.9; ctx.fillStyle = C.ink2; ctx.fillRect(o.x + Math.cos(ang) * o.a - 0.7, o.y + Math.sin(ang) * o.a - 0.7, 1.4, 1.4); } });
            // streamlines in the accent, traced from the left through the current flow
            [0.22, 0.42, 0.58, 0.78].forEach((h, k) => {
                let x = fx - 10, y = vy0 + h * vh;
                ctx.fillStyle = C.accent;
                for (let i = 0; i < 360 && x < R.x + R.w; i++) {
                    const [ux, uy] = vel(x, y), m = Math.hypot(ux, uy) || 1; x += (ux / m) * 2.2; y += (uy / m) * 2.2;
                    if (i % 1 === 0) { ctx.globalAlpha = k === 1 ? 0.95 : 0.5; ctx.beginPath(); ctx.arc(x, y, k === 1 ? 1.1 : 0.85, 0, TAU); ctx.fill(); }
                    if (m < 0.5 || ux < U * 0.08) break;                              // stop where the superposed flow stalls or reverses
                }
            });
        },
    };

    // Conway's Game of Life as a point display: every living cell holds one dot. At each generation the
    // survivors stay; dots of dying cells travel to the nearest newborn cells, so the pattern visibly
    // flows into its next state; spare dots fade where they are, missing ones fade in. Static until
    // touched: a click runs it for a while, dragging draws living cells (in the accent).
    F.life = {
        bleed: true,
        title: 'Game of Life', note: 'Conway’s automaton as moving points: click to run, drag to draw living cells.',
        STEP: 0.3,
        init(R, rand) {
            const S = 8, Cx = Math.ceil(R.w / S), Cy = Math.ceil(R.h / S), r = rand(5), fxC = Math.floor(((R.fx ?? R.x) - R.x) / S);
            const cells = new Uint8Array(Cx * Cy), painted = new Uint8Array(Cx * Cy);
            const vy0C = Math.floor(((R.vy0 ?? R.y) - R.y) / S), vy1C = Math.ceil(((R.vy1 ?? R.y + R.h) - R.y) / S);
            for (let y = vy0C; y < vy1C; y++) for (let x = fxC - 6; x < Cx; x++) if (x >= 0 && r() < 0.2) cells[y * Cx + x] = 1;
            [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]].forEach(([dx, dy]) => { cells[(vy0C + 1 + dy) * Cx + fxC + 2 + dx] = 1; });   // a glider
            const st = { S, Cx, Cy, cells, painted, last: 0, dots: [], at: new Int32Array(Cx * Cy).fill(-1) };
            const pos = (i) => [R.x + (i % Cx) * S + S / 2, R.y + Math.floor(i / Cx) * S + S / 2];
            st.pos = pos;
            cells.forEach((v, i) => { if (v) { const [x, y] = pos(i); st.at[i] = st.dots.length; st.dots.push({ x0: x, y0: y, x, y, a0: 1, a: 1, cell: i }); } });
            return st;
        },
        // one generation; dots are re-assigned: survivors stay, the freed dots move to births
        step(st, t) {
            const { Cx, Cy, cells, painted } = st, next = new Uint8Array(Cx * Cy), np = new Uint8Array(Cx * Cy);
            for (let y = 0; y < Cy; y++) for (let x = 0; x < Cx; x++) {
                let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += cells[((y + dy + Cy) % Cy) * Cx + ((x + dx + Cx) % Cx)];
                const i = y * Cx + x, alive = n === 3 || (cells[i] && n === 2);
                next[i] = alive ? 1 : 0; np[i] = alive && (painted[i] || (n === 3 && !cells[i] && F.life.paintedNear(st, x, y))) ? 1 : 0;
            }
            // settle every dot where it was heading, then plan the next move
            const dots = st.dots.filter((d) => d.a > 0.01 || d.cell >= 0);
            dots.forEach((d) => { d.x0 = d.x; d.y0 = d.y; d.a0 = d.a; });
            const at = new Int32Array(Cx * Cy).fill(-1), free = [], births = [];
            dots.forEach((d, k) => { if (d.cell >= 0 && next[d.cell]) at[d.cell] = k; else { d.cell = -1; free.push(k); } });
            next.forEach((v, i) => { if (v && at[i] < 0) births.push(i); });
            // greedy nearest matching of freed dots to births, nearest pairs first (kept local: within 6 cells)
            const pairs = [];
            births.forEach((b) => { const bx = b % Cx, by = (b / Cx) | 0; free.forEach((k) => { const d = dots[k], cx = Math.round((d.x - st.pos(0)[0]) / st.S), cy = Math.round((d.y - st.pos(0)[1]) / st.S), dd = Math.abs(cx - bx) + Math.abs(cy - by); if (dd <= 6) pairs.push([dd, b, k]); }); });
            pairs.sort((p, q) => p[0] - q[0]);
            const used = new Set();
            pairs.forEach(([, b, k]) => { if (at[b] >= 0 || used.has(k)) return; used.add(k); at[b] = k; const [x, y] = st.pos(b); Object.assign(dots[k], { x, y, a: 1, cell: b }); });
            free.forEach((k) => { if (!used.has(k)) dots[k].a = 0; });                                 // spare dots fade in place
            births.forEach((b) => { if (at[b] >= 0) return; const [x, y] = st.pos(b); at[b] = dots.length; dots.push({ x0: x, y0: y, x, y, a0: 0, a: 1, cell: b }); });
            Object.assign(st, { cells: next, painted: np, dots, at, last: t });
        },
        paintedNear(st, x, y) {
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = ((y + dy + st.Cy) % st.Cy) * st.Cx + ((x + dx + st.Cx) % st.Cx); if ((dx || dy) && st.cells[i] && st.painted[i]) return true; }
            return false;
        },
        pointer(type, x, y, st, R, buttons) {
            const cx = Math.floor((x - R.x) / st.S), cy = Math.floor((y - R.y) / st.S);
            if (cx < 0 || cy < 0 || cx >= st.Cx || cy >= st.Cy) return;
            const add = (x, y) => {
                if (x < 0 || y < 0 || x >= st.Cx || y >= st.Cy) return;
                const i = y * st.Cx + x; st.painted[i] = 1;
                if (!st.cells[i]) { st.cells[i] = 1; const [px, py] = st.pos(i); st.at[i] = st.dots.length; st.dots.push({ x0: px, y0: py, x: px, y: py, a0: 0, a: 1, cell: i }); }
            };
            // a press drops a glider heading away from the corner it is nearest; dragging draws single cells
            if (type === 'down') { const fx2 = cx < st.Cx / 2 ? 1 : -1, fy2 = cy < st.Cy / 2 ? 1 : -1; [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]].forEach(([dx, dy]) => add(cx + (dx - 1) * fx2, cy + (dy - 1) * fy2)); st.wake = 10; }
            else if (type === 'move' && buttons) { add(cx, cy); st.wake = 10; }
        },
        draw(ctx, R, t, C, st, still) {
            if (!still && st.touched && t - st.last > F.life.STEP) F.life.step(st, t);
            const u = still ? 1 : smooth(Math.min(1, (t - st.last) / (F.life.STEP * 0.85)));
            // the lattice, faint
            ctx.globalAlpha = 0.3; ctx.fillStyle = C.ink3;
            for (let y = 0; y < st.Cy; y++) for (let x = 0; x < st.Cx; x++) { const [px, py] = st.pos(y * st.Cx + x); ctx.fillRect(px - 0.6, py - 0.6, 1.2, 1.2); }
            st.dots.forEach((d) => {
                const a = d.a0 + (d.a - d.a0) * u; if (a < 0.01) return;
                const x = d.x0 + (d.x - d.x0) * u, y = d.y0 + (d.y - d.y0) * u, accent = st.touched && d.cell >= 0 && st.painted[d.cell];
                ctx.globalAlpha = a * (accent ? 1 : 0.8); ctx.fillStyle = accent ? C.accent : C.ink;
                ctx.beginPath(); ctx.arc(x, y, 1.1, 0, TAU); ctx.fill();
            });
        },
    };

    // Predictive coding: a hierarchy of four layers (sensory input on the right, higher layers to the
    // left, fading into the ground). Each scene presents a new input and runs real predictive-coding
    // inference: every layer predicts the one below, the mismatch is the error, the layer above updates
    // to reduce it. Errors flow up the links as accent points (more where the error is large) and make
    // their units glow; predictions flow down as grey points; as inference settles the traffic calms.
    F.predictive = {
        bleed: true,
        title: 'Predictive coding', note: 'A hierarchy infers by minimising prediction error: errors flow up in the accent, predictions flow down, and the network settles.',
        init: () => ({ n: -1 }),
        SIZES: [10, 7, 5, 3],
        build(R, r) {
            const sizes = F.predictive.SIZES, fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vh = (R.vy1 ?? R.y + R.h) - vy0;
            const xs = sizes.map((_, l) => R.x + R.w - 22 - l * Math.min(96, (R.x + R.w - fx + 140) / 4));
            const units = sizes.map((n, l) => Array.from({ length: n }, (_, k) => [xs[l], vy0 + ((k + 0.5) / n) * vh]));
            const W = sizes.slice(1).map((n, l) => Array.from({ length: sizes[l] }, () => Array.from({ length: n }, () => (r() - 0.5) * 2.2)));   // W[l]: layer l+1 → layer l
            return { units, W };
        },
        infer(net, x) {
            const sizes = F.predictive.SIZES, mu = [x.slice(), ...sizes.slice(1).map((n) => Array(n).fill(0))], history = [];
            const tanh = Math.tanh;
            // gradient descent on the prediction-error energy E = ½ Σ ‖μ_l − tanh(W_l μ_{l+1})‖²
            for (let it = 0; it < 160; it++) {
                const pred = net.W.map((Wl, l) => Wl.map((row) => tanh(row.reduce((a, w, j) => a + w * mu[l + 1][j], 0))));
                const err = pred.map((p, l) => mu[l].map((v, k) => v - p[k]));
                history.push({ mu: mu.map((m) => m.slice()), err: err.map((e) => e.slice()) });
                for (let l = 1; l < sizes.length; l++) for (let j = 0; j < sizes[l]; j++) {
                    let g = 0; for (let k = 0; k < sizes[l - 1]; k++) g += net.W[l - 1][k][j] * err[l - 1][k] * (1 - pred[l - 1][k] ** 2);
                    const own = l < sizes.length - 1 ? err[l][j] : 0;
                    mu[l][j] += 0.12 * (g - own);
                }
            }
            return history;
        },
        draw(ctx, R, t, C, s, still, rand) {
            const P = 12, n = Math.floor(t / P), p = still ? 0.95 : (t % P) / P, sizes = F.predictive.SIZES;
            if (s.n !== n || s.key !== `${R.x},${R.w},${R.h}`) {
                const r = rand(n * 3 + 1);
                if (!s.net || s.key !== `${R.x},${R.w},${R.h}`) s.net = F.predictive.build(R, rand(9));
                s.prevX = s.x || Array(sizes[0]).fill(0);
                // the input is generated by the hierarchy itself from a random top-level cause (plus a little
                // noise), so inference can genuinely explain it
                let z = Array.from({ length: sizes[sizes.length - 1] }, () => (r() - 0.5) * 2.4);
                for (let l = sizes.length - 2; l >= 0; l--) z = s.net.W[l].map((row) => Math.tanh(row.reduce((a, w, j) => a + w * z[j], 0)));
                s.x = z.map((v) => v + (r() - 0.5) * 0.08);
                s.hist = F.predictive.infer(s.net, s.x); s.n = n; s.key = `${R.x},${R.w},${R.h}`;
            }
            const { units, W } = s.net, H = s.hist;
            // inference runs over most of the scene; early iterations change fastest
            const it = still ? H.length - 1 : Math.min(H.length - 1, Math.floor(Math.pow(Math.min(1, p / 0.8), 0.6) * (H.length - 1)));
            const { mu, err } = H[it], inMix = still ? 1 : smooth(p / 0.08);
            const act = (l, k) => (l === 0 ? s.prevX[k] + (s.x[k] - s.prevX[k]) * inMix : mu[l][k]);
            const tt = still ? 0 : t;
            // links: faint dotted lines between adjacent layers
            ctx.fillStyle = C.ink3;
            for (let l = 0; l < sizes.length - 1; l++) for (const a of units[l]) for (const b of units[l + 1]) {
                const d = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.floor(d / 6);
                for (let q = 1; q < m; q++) { ctx.globalAlpha = 0.16; ctx.fillRect(a[0] + (b[0] - a[0]) * (q / m) - 0.5, a[1] + (b[1] - a[1]) * (q / m) - 0.5, 1, 1); }
            }
            // traffic: errors flow up (accent), predictions flow down (grey)
            for (let l = 0; l < sizes.length - 1; l++) units[l].forEach((a, k) => units[l + 1].forEach((b, j) => {
                const e = Math.min(1, Math.abs(err[l][k]) * 1.4), w = Math.abs(W[l][k][j]), seed = (l * 131 + k * 17 + j * 7) % 97 / 97;
                for (let q = 0; q < 2; q++) {
                    const up = (tt * 0.35 + seed + q * 0.5) % 1, dn = (tt * 0.22 + seed * 1.7 + q * 0.5) % 1;
                    if (e > 0.04) { ctx.globalAlpha = e * w * 0.9; ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(a[0] + (b[0] - a[0]) * up, a[1] + (b[1] - a[1]) * up, 1.2, 0, TAU); ctx.fill(); }
                    ctx.globalAlpha = 0.28 * w; ctx.fillStyle = C.ink2; ctx.fillRect(b[0] + (a[0] - b[0]) * dn - 0.6, b[1] + (a[1] - b[1]) * dn - 0.6, 1.2, 1.2);
                }
            }));
            // units: a ring of points; activity fills it; error makes it glow in the accent
            units.forEach((layer, l) => layer.forEach(([x, y], k) => {
                const v = act(l, k), e = l < sizes.length - 1 ? Math.min(1, Math.abs(err[l][k]) * 1.4) : 0, br = 0.6 * Math.sin(tt * 0.6 + l * 3 + k);
                for (let q = 0; q < 10; q++) { const a = (q / 10) * TAU; ctx.globalAlpha = 0.55; ctx.fillStyle = C.ink3; ctx.fillRect(x + Math.cos(a) * 5.5 - 0.6, y + br + Math.sin(a) * 5.5 - 0.6, 1.2, 1.2); }
                const fill = Math.max(0, Math.min(1, (v + 1) / 2));
                for (let q = 0; q < 7; q++) { const a = (q / 7) * TAU + 0.4, rr = q === 6 ? 0 : 2.6; ctx.globalAlpha = 0.85 * fill; ctx.fillStyle = C.ink2; ctx.fillRect(x + Math.cos(a) * rr - 0.7, y + br + Math.sin(a) * rr - 0.7, 1.4, 1.4); }
                if (e > 0.05) { ctx.globalAlpha = 0.75 * e; ctx.strokeStyle = C.accent; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y + br, 7.5, 0, TAU); ctx.stroke(); }
            }));
        },
    };

    const ARC_RULES = [(m) => m.map((q) => [...q].reverse()), (m) => [...m].reverse(), (m) => m[0].map((_, i) => m.map((q) => q[i])),
        (m) => { const N = m.length, o = m.map((q) => q.map(() => 0)); for (let i = 0; i < N; i++) { let k = N - 1; for (let j = N - 1; j >= 0; j--) if (m[j][i]) o[k--][i] = 1; } return o; }];

    // ── direct figures: drawn from state each frame, changed only by the reader ──────────────────

    // GRPO (group relative policy optimisation, DeepSeekMath): from one prompt a group of eight completions;
    // a verifier marks each right or wrong; each completion's advantage is its reward minus the group mean,
    // over the group's spread. Click an answer to flip its reward and the bars re-balance; a uniform group
    // has no advantage at all. Click the prompt for a new group.
    F.grpo = {
        bleed: true,
        title: 'GRPO', note: 'A group of completions, verifier rewards and group-relative advantages; click an answer to flip its reward.',
        init(R, rand) { const st = { r: rand(11), born: -1 }; F.grpo.sample(st, R); return st; },
        sample(st, R) {
            const r = st.r, G = 8, fx = R.fx ?? R.x, vy0 = (R.vy0 ?? R.y) + 14, vh = (R.vy1 ?? R.y + R.h) - vy0, W = R.x + R.w - fx;
            const root = [fx + 10, vy0 + vh / 2], ex = fx + W * 0.52, bx = fx + W * 0.8, row = vh / G;
            const ys = Array.from({ length: G }, (_, i) => vy0 + (i + 0.5) * row);
            const paths = ys.map((ey) => {
                const c1 = [root[0] + W * (0.12 + 0.12 * r()), root[1] + (r() - 0.5) * vh * 0.7], c2 = [ex - W * (0.12 + 0.08 * r()), ey + (r() - 0.5) * row * 2];
                return Array.from({ length: 60 }, (_, k) => { const u = k / 59, v = 1 - u; return [v ** 3 * root[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u ** 3 * ex, v ** 3 * root[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u ** 3 * ey]; });
            });
            let rewards = ys.map(() => (r() < 0.4 ? 1 : 0));
            if (rewards.every((v) => v === rewards[0])) rewards[Math.floor(r() * G)] ^= 1;
            Object.assign(st, { G, root, ex, bx, ys, row, paths, rewards, unit: W * 0.075, vy0, bars: null, born: st.born === -1 ? -1 : null });
        },
        stats(st) {
            const G = st.G, mean = st.rewards.reduce((a, b) => a + b, 0) / G, sd = Math.sqrt(st.rewards.reduce((a, b) => a + (b - mean) ** 2, 0) / G);
            return { mean, sd, adv: st.rewards.map((v) => (sd > 0 ? (v - mean) / sd : 0)) };
        },
        pointer(type, x, y, st) {
            const near = Math.hypot(x - st.root[0], y - st.root[1]) < 20;
            const i = Math.max(0, Math.min(st.G - 1, Math.floor((y - st.vy0) / st.row))), onRow = x > st.ex - 40 && y > st.vy0 - 4 && y < st.vy0 + st.G * st.row + 4;
            st.hov = type === 'leave' ? null : near ? 'root' : onRow ? i : null;
            if (type === 'down') {
                if (near) { F.grpo.sample(st, st.R); st.wake = 1.2; }
                else if (onRow) { st.rewards[i] ^= 1; st.wake = 1.2; }
            }
        },
        draw(ctx, R, t, C, st, still) {
            st.R = R;
            if (st.born == null) st.born = t;
            const fadeIn = still || st.born < 0 ? 1 : smooth((t - st.born) / 0.6);
            const { mean, sd, adv } = F.grpo.stats(st), live = st.touched;
            if (!st.bars || still) st.bars = adv.slice();
            st.bars = st.bars.map((b, i) => (still ? adv[i] : b + (adv[i] - b) * Math.min(1, Math.max(0, t - (st._t ?? t)) * 9)));
            st._t = t;
            // completions: faint dotted curves; the ones the update will reinforce in the accent, by advantage
            st.paths.forEach((q, i) => {
                const a = st.bars[i], pos = a > 0.01, hov = st.hov === i;
                for (let k = 0; k < q.length; k += pos ? 1 : 2) {
                    const [x, y] = q[k];
                    ctx.globalAlpha = fadeIn * (pos ? Math.min(1, 0.35 + 0.3 * a) : hov ? 0.6 : 0.3);
                    ctx.fillStyle = pos ? (live ? C.accent : C.ink) : C.ink3;
                    ctx.beginPath(); ctx.arc(x, y, pos ? 0.6 + 0.35 * Math.min(2, a) : 0.6, 0, TAU); ctx.fill();
                }
                // reward: a filled disc for a correct answer, a ring for a wrong one
                const y = st.ys[i];
                ctx.globalAlpha = fadeIn; ctx.lineWidth = 1; ctx.strokeStyle = hov ? C.ink : C.ink2; ctx.fillStyle = hov ? C.ink : C.ink2;
                ctx.beginPath(); ctx.arc(st.ex + 6, y, 3.6, 0, TAU); st.rewards[i] ? ctx.fill() : ctx.stroke();
                // advantage bar: dots from the zero line
                const len = st.bars[i] * st.unit, n = Math.round(Math.abs(len) / 3);
                ctx.fillStyle = a > 0 && live ? C.accent : C.ink2;
                for (let k = 1; k <= n; k++) { ctx.globalAlpha = fadeIn * (a > 0 ? 0.95 : 0.55); ctx.fillRect(st.bx + Math.sign(len) * k * 3 - 0.9, y - 0.9, 1.8, 1.8); }
            });
            // prompt, zero line and column labels
            ctx.globalAlpha = 1; ctx.fillStyle = st.hov === 'root' ? C.ink : C.ink2; ctx.beginPath(); ctx.arc(st.root[0], st.root[1], 3.6, 0, TAU); ctx.fill();
            ctx.globalAlpha = 0.5; ctx.fillStyle = C.ink3;
            for (let y = st.vy0 - 2; y < st.vy0 + st.G * st.row + 2; y += 3) ctx.fillRect(st.bx - 0.5, y, 1, 1);
        },
    };

    // ARC-AGI-3 style: a small grid game with no instructions, learned by acting. Each level picks one
    // mechanic: reach the goal; take the key to open the door; push the block onto the target; or step
    // on the switch to flip which walls stand. The reader moves with the arrow keys (or WASD) while the
    // pointer is over the figure, or clicks a cell to step toward it. A cleared level ripples out from
    // the goal and the next one assembles from its points; dots along the top count cleared levels.
    F.arc3 = {
        bleed: true,
        title: 'ARC-AGI-3', note: 'An interactive grid game learned by acting: reach, key and door, push, switch. Arrow keys or clicks.',
        MECH: ['reach', 'key', 'push', 'switch'],
        init(R, rand) {
            const st = { r: rand(23), level: 0, cleared: 0, born: -1, R };
            const fx = R.fx ?? R.x, vy0 = (R.vy0 ?? R.y) + 10, vy1 = R.vy1 ?? R.y + R.h, W = R.x + R.w - fx - 8;
            st.S = Math.max(12, Math.min(18, Math.floor((vy1 - vy0) / 9)));
            st.Cy = Math.floor((vy1 - vy0) / st.S); st.Cx = Math.min(22, Math.floor(W / st.S));
            st.ox = fx + Math.floor((W - st.Cx * st.S) / 2); st.oy = vy0 + Math.floor((vy1 - vy0 - st.Cy * st.S) / 2);
            F.arc3.make(st, 'reach');
            return st;
        },
        make(st, mech) {
            const { r, Cx, Cy } = st, rnd = (n) => Math.floor(r() * n);
            for (let tries = 0; tries < 600; tries++) {
                const wall = new Uint8Array(Cx * Cy), L = { mech, wall, player: null, goal: null, key: null, door: [], box: null, target: null, sw: null, gateA: [], gateB: [], hasKey: false, flipped: false };
                for (let x = 0; x < Cx; x++) { wall[x] = 1; wall[(Cy - 1) * Cx + x] = 1; }
                for (let y = 0; y < Cy; y++) { wall[y * Cx] = 1; wall[y * Cx + Cx - 1] = 1; }
                const free = (x, y) => x > 0 && y > 0 && x < Cx - 1 && y < Cy - 1 && !wall[y * Cx + x];
                const scatter = (n) => { for (let k = 0; k < n; k++) { const x = 1 + rnd(Cx - 2), y = 1 + rnd(Cy - 2); wall[y * Cx + x] = 1; } };
                if (mech === 'reach') {
                    scatter(Math.floor(Cx * Cy * 0.14));
                    L.player = [1 + rnd(3), 1 + rnd(Cy - 2)]; L.goal = [Cx - 2 - rnd(3), 1 + rnd(Cy - 2)];
                } else if (mech === 'key' || mech === 'switch') {
                    // a dividing wall; the far side holds the goal
                    const mx = Math.floor(Cx / 2) + rnd(3) - 1;
                    for (let y = 1; y < Cy - 1; y++) wall[y * Cx + mx] = 1;
                    scatter(Math.floor(Cx * Cy * 0.06));
                    for (let y = 1; y < Cy - 1; y++) wall[y * Cx + mx] = 1;
                    L.player = [1 + rnd(2), 1 + rnd(Cy - 2)]; L.goal = [Cx - 2 - rnd(2), 1 + rnd(Cy - 2)];
                    if (mech === 'key') { const dy = 1 + rnd(Cy - 2); wall[dy * Cx + mx] = 0; L.door = [[mx, dy]]; L.key = [1 + rnd(mx - 1), 1 + rnd(Cy - 2)]; }
                    else {
                        // a gate in the wall, shut until the switch is stepped on; the same flip raises a few
                        // phase walls on the far side, so the way through changes with it
                        const gy = 1 + rnd(Cy - 2); wall[gy * Cx + mx] = 0; L.gateB = [[mx, gy]];
                        for (let k = 0; k < 4; k++) { const x = mx + 2 + rnd(Math.max(1, Cx - mx - 3)), y = 1 + rnd(Cy - 2); if (!wall[y * Cx + x]) L.gateA.push([x, y]); }
                        L.sw = [1 + rnd(mx - 1), 1 + rnd(Cy - 2)];
                    }
                } else if (mech === 'push') {
                    scatter(Math.floor(Cx * Cy * 0.05));
                    const horiz = r() < 0.6, y = 2 + rnd(Cy - 4), x = 2 + rnd(Cx - 4);
                    if (horiz) { const bx = 3 + rnd(Math.max(1, Math.floor(Cx / 2) - 3)), tx = Math.min(Cx - 3, bx + 3 + rnd(Cx - bx - 5 > 0 ? Cx - bx - 5 : 1)); for (let xx = bx - 2; xx <= tx; xx++) wall[y * Cx + xx] = 0; L.box = [bx, y]; L.target = [tx, y]; L.player = [bx - 2, y]; }
                    else { const by = 2, ty = Cy - 3; for (let yy = by - 1; yy <= ty; yy++) wall[yy * Cx + x] = 0; L.box = [x, by + (Cy > 7 ? 1 : 0)]; L.target = [x, ty]; L.player = [x, by - 1 + (Cy > 7 ? 1 : 0) - 1 + 1 - 1]; }
                    if (L.player[1] < 1) L.player[1] = 1;
                }
                // clear what the pieces stand on
                [L.player, L.goal, L.key, L.box, L.target, L.sw].forEach((q) => { if (q) wall[q[1] * Cx + q[0]] = 0; });
                L.door.forEach(([x, y]) => (wall[y * Cx + x] = 0));
                if (L.gateA.some(([x, y]) => (L.goal && x === L.goal[0] && y === L.goal[1]))) continue;
                if (F.arc3.solvable(st, L)) { st.L = L; st.moves = 0; st.won = null; st.anim = {}; st.pp = L.player.slice(); return; }
            }
            F.arc3.make(st, 'reach');
        },
        blocked(st, L, x, y) {
            const { Cx, Cy } = st;
            if (x < 0 || y < 0 || x >= Cx || y >= Cy || L.wall[y * Cx + x]) return true;
            if (L.mech === 'key' && !L.hasKey && L.door.some(([a, b]) => a === x && b === y)) return true;
            if (L.mech === 'switch') { const shut = L.flipped ? L.gateA : L.gateB; if (shut.some(([a, b]) => a === x && b === y)) return true; }
            return false;
        },
        // breadth-first search over (player, key/switch/box) states: the level must be clearable
        solvable(st, L0) {
            const { Cx } = st, D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            const key = (L) => `${L.player}|${L.hasKey}|${L.flipped}|${L.box}`;
            const clone = (L) => ({ ...L, player: L.player.slice(), box: L.box && L.box.slice() });
            const seen = new Set([key(L0)]), q = [clone(L0)];
            while (q.length) {
                const L = q.shift();
                if (F.arc3.done(L)) return true;
                if (seen.size > 6000) return false;
                for (const d of D) { const n = clone(L); if (F.arc3.step(st, n, d) && !seen.has(key(n))) { seen.add(key(n)); q.push(n); } }
            }
            return false;
        },
        done(L) { return L.mech === 'push' ? L.box[0] === L.target[0] && L.box[1] === L.target[1] : L.player[0] === L.goal[0] && L.player[1] === L.goal[1]; },
        step(st, L, [dx, dy]) {
            const [x, y] = L.player, nx = x + dx, ny = y + dy;
            if (L.mech === 'push' && L.box && L.box[0] === nx && L.box[1] === ny) {
                const bx = nx + dx, by = ny + dy; if (F.arc3.blocked(st, L, bx, by)) return false;
                L.box = [bx, by];
            } else if (F.arc3.blocked(st, L, nx, ny)) return false;
            L.player = [nx, ny];
            if (L.mech === 'key' && L.key && nx === L.key[0] && ny === L.key[1]) L.hasKey = true;
            if (L.mech === 'switch' && L.sw && nx === L.sw[0] && ny === L.sw[1]) L.flipped = !L.flipped;
            return true;
        },
        move(st, d, t) {
            const L = st.L; if (!L || st.won) return;
            const before = { p: L.player.slice(), b: L.box && L.box.slice(), k: L.hasKey, f: L.flipped };
            if (!F.arc3.step(st, L, d)) { st.bump = { d, t: null }; return; }
            st.moves++;
            st.anim = { p0: before.p, b0: before.b, t: null, key: !before.k && L.hasKey, flip: before.f !== L.flipped };
            if (F.arc3.done(L)) st.won = { t: null, at: L.mech === 'push' ? L.target.slice() : L.goal.slice() };
        },
        pointer(type, x, y, st) {
            if (type === 'key') { F.arc3.move(st, x); st.wake = 1.2; return; }
            if (type !== 'down' || !st.L) return;
            const cx = Math.floor((x - st.ox) / st.S), cy = Math.floor((y - st.oy) / st.S), [px, py] = st.L.player;
            const dx = cx - px, dy = cy - py; if (!dx && !dy) return;
            F.arc3.move(st, Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]); st.wake = 1.2;
        },
        draw(ctx, R, t, C, st, still) {
            const { S, Cx, Cy, ox, oy } = st, L = st.L, live = st.touched;
            if (st.born == null) st.born = t;
            if (st.anim.t === null) st.anim.t = t;
            if (st.bump && st.bump.t === null) st.bump.t = t;
            if (st.won && st.won.t === null) { st.won.t = t; st.wake = 2.4; }
            // cleared: ripple, then the next level assembles
            if (st.won && !still && t - st.won.t > 1.1) {
                st.cleared++; const others = F.arc3.MECH.filter((m) => m !== st.L.mech), mech = others[Math.floor(st.r() * others.length)]; F.arc3.make(st, mech);   // always a new mechanic st.born = t; st.wake = 1.5;
            }
            const build = still || st.born < 0 ? 1 : smooth((t - st.born) / 0.9);
            const ripple = st.won && !still ? (t - st.won.t) / 1.1 : -1;
            const cx = (x) => ox + x * S + S / 2, cy = (y) => oy + y * S + S / 2;
            const u = still ? 1 : smooth(Math.min(1, (t - (st.anim.t ?? t)) / 0.14));
            // cell: a point screen; d is the cell's distance from the ripple centre
            const screen = (x, y, n, alpha, size, color) => {
                let a = alpha * build, k = 1;
                const order = (x * 7 + y * 13) % 10 / 10; a *= smooth(build * 1.6 - order * 0.6);
                if (ripple >= 0) { const d = Math.hypot(x - st.won.at[0], y - st.won.at[1]) / 10; const w = Math.exp(-((ripple * 1.6 - d) ** 2) / 0.01); k = 1 + 0.9 * w; a = Math.min(1, a + 0.5 * w); if (ripple > 0.6) a *= 1 - smooth((ripple - 0.6) / 0.4); }
                ctx.globalAlpha = a; ctx.fillStyle = color;
                const g = (S - 4) / n;
                for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const px = x * S + 2 + (i + 0.5) * g + ox, py = y * S + 2 + (j + 0.5) * g + oy; ctx.fillRect(px - size * k / 2, py - size * k / 2, size * k, size * k); }
            };
            for (let y = 0; y < Cy; y++) for (let x = 0; x < Cx; x++) {
                if (L.wall[y * Cx + x]) screen(x, y, 3, 0.75, 1.5, C.ink2);
                else screen(x, y, 1, 0.35, 1.2, C.ink3);
            }
            const ring = (x, y, rr, alpha, color, w = 1.2) => { ctx.globalAlpha = alpha * build; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(cx(x), cy(y), rr, 0, TAU); ctx.stroke(); };
            // pieces
            if (L.goal && L.mech !== 'push') { ring(L.goal[0], L.goal[1], S * 0.32, 0.9, C.ink); ring(L.goal[0], L.goal[1], S * 0.14, 0.9, C.ink); }
            if (L.target) { ctx.globalAlpha = 0.8 * build; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]); ctx.strokeRect(cx(L.target[0]) - S * 0.36, cy(L.target[1]) - S * 0.36, S * 0.72, S * 0.72); ctx.setLineDash([]); }
            if (L.key && !L.hasKey) { const kx = cx(L.key[0]), ky = cy(L.key[1]); ctx.globalAlpha = build; ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(kx, ky - 4); ctx.lineTo(kx + 4, ky); ctx.lineTo(kx, ky + 4); ctx.lineTo(kx - 4, ky); ctx.closePath(); ctx.fill(); }
            L.door.forEach(([x, y]) => { const open = L.hasKey, f = st.anim.key ? u : 1; ctx.globalAlpha = (open ? 1 - f : 1) * 0.95 * build; ctx.fillStyle = C.ink; ctx.fillRect(cx(x) - 2, oy + y * S + 1, 4, S - 2); });
            if (L.mech === 'switch') {
                const shut = L.flipped ? L.gateA : L.gateB, open = L.flipped ? L.gateB : L.gateA, f = st.anim.flip ? u : 1;
                shut.forEach(([x, y]) => screen(x, y, 3, 0.95 * f, 1.8, C.ink));
                open.forEach(([x, y]) => { if (f < 1) screen(x, y, 3, 0.95 * (1 - f), 1.8, C.ink); ctx.globalAlpha = 0.5 * build; ctx.strokeStyle = C.ink3; ctx.lineWidth = 1; ctx.strokeRect(ox + x * S + 2.5, oy + y * S + 2.5, S - 5, S - 5); });
                if (L.sw) { ctx.globalAlpha = build; ctx.fillStyle = L.flipped ? C.ink : C.bg ?? C.ink3; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; const sx = cx(L.sw[0]), sy = cy(L.sw[1]); ctx.strokeRect(sx - 3.5, sy - 3.5, 7, 7); if (L.flipped) ctx.fillRect(sx - 2, sy - 2, 4, 4); }
            }
            if (L.box) { const [bx0, by0] = st.anim.b0 || L.box, bx = bx0 + (L.box[0] - bx0) * u, by = by0 + (L.box[1] - by0) * u; screen(bx, by, 3, 1, 2.2, C.ink); }
            // the player: a solid block, gliding between cells, nudging against walls it cannot pass
            const [p0x, p0y] = st.anim.p0 || L.player;
            let px = cx(p0x + (L.player[0] - p0x) * u), py = cy(p0y + (L.player[1] - p0y) * u);
            if (st.bump && !still) { const e = (t - st.bump.t) / 0.18; if (e < 1) { const k = Math.sin(e * Math.PI) * 2.5; px += st.bump.d[0] * k; py += st.bump.d[1] * k; } }
            ctx.globalAlpha = build; ctx.fillStyle = C.ink; ctx.fillRect(px - S * 0.3, py - S * 0.3, S * 0.6, S * 0.6);
            if (L.hasKey) { ctx.fillStyle = C.bg || '#fff'; ctx.globalAlpha = build; ctx.beginPath(); ctx.moveTo(px, py - 2.5); ctx.lineTo(px + 2.5, py); ctx.lineTo(px, py + 2.5); ctx.lineTo(px - 2.5, py); ctx.closePath(); ctx.fill(); }
            // levels cleared, and moves used, as dots along the top edge
            for (let k = 0; k < 8; k++) { ctx.globalAlpha = k < st.cleared ? 0.95 : 0.3; ctx.fillStyle = k < st.cleared ? C.ink : C.ink3; ctx.beginPath(); ctx.arc(ox + Cx * S - 4 - k * 7, oy - 8, k < st.cleared ? 2 : 1.3, 0, TAU); ctx.fill(); }
            for (let k = 0; k < Math.min(st.moves, 40); k++) { ctx.globalAlpha = 0.5; ctx.fillStyle = C.ink3; ctx.fillRect(ox + k * 4, oy - 8.5, 1.5, 1.5); }
            if (!still && (u < 1 || (st.bump && t - st.bump.t < 0.2) || build < 1)) st.wake = Math.max(st.wake || 0, 0.25);
        },
    };

    // ARC: two worked examples of a hidden rule and a test. The reader paints the test's output; when it
    // matches the rule the cells turn to ink, a tick appears, and the next task fades in.
    F.arc = {
        bleed: true,
        title: 'ARC', note: 'Two examples of a rule and a test; click cells to paint the answer, the arrow for another task.',
        init(R, rand) { const st = { r: rand(13), born: -1 }; F.arc.task(st, R); return st; },
        task(st, R) {
            const r = st.r, fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vh = (R.vy1 ?? R.y + R.h) - vy0, W = R.x + R.w - fx;
            const rule = ARC_RULES[Math.floor(r() * ARC_RULES.length)];
            const grid = (N) => {
                for (;;) {
                    const g = Array.from({ length: N }, () => Array(N).fill(0));
                    for (let o = 1 + Math.floor(r() * 3); o > 0; o--) { const w = 1 + Math.floor(r() * Math.min(3, N - 1)), h = 1 + Math.floor(r() * 2), x = Math.floor(r() * (N - w + 1)), y = Math.floor(r() * (N - h + 1)); for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = 1; }
                    const out = rule(g);
                    if (JSON.stringify(out) !== JSON.stringify(g)) return [g, out];                // the rule must visibly act
                }
            };
            // layout: the two examples small, side by side on top; the test large below
            const sp = 5, gapX = 16, pairW = (N) => 2 * N * sp + 14;
            const ex = [0, 1].map((k) => { const N = 4 + Math.floor(r() * 3), [g, out] = grid(N); return { N, g, out, p: sp }; });
            const N = 4 + Math.floor(r() * 3), [g, out] = grid(N), top = vy0 + 6 * sp + 18;
            const tp2 = Math.floor(Math.min((W - 8 - 26) / (2 * N), (vy0 + vh - top) / N, 24));
            // centred in the visible part
            const testW = 2 * N * tp2 + 26, exW = pairW(ex[0].N) + gapX + pairW(ex[1].N), left = fx + Math.max(4, (W - Math.max(testW, exW)) / 2);
            ex[0].x = left; ex[1].x = ex[0].x + pairW(ex[0].N) + gapX; ex.forEach((e) => { e.y = vy0; });
            const tx = left, ty = top;
            Object.assign(st, { ex, test: { N, g, out, p: tp2, x: tx, y: ty, ox: tx + N * tp2 + 26 }, paint: out.map((q) => q.map(() => 0)), solvedAt: null, born: st.born === -1 ? -1 : null, hov: null });
        },
        cell(ctx, C, x, y, p, on, alpha, color) {                             // a cell: 3×3 point screen, or one faint point
            if (on) { ctx.globalAlpha = alpha; ctx.fillStyle = color; for (let k = 0; k < 9; k++) ctx.fillRect(x + ((k % 3) + 0.5) * (p - 2) / 3 + 1 - 0.75, y + (Math.floor(k / 3) + 0.5) * (p - 2) / 3 + 1 - 0.75, 1.5, 1.5); }
            else { ctx.globalAlpha = alpha * 0.45; ctx.fillStyle = C.ink3; ctx.fillRect(x + p / 2 - 0.5, y + p / 2 - 0.5, 1, 1); }
        },
        pointer(type, x, y, st) {
            const T = st.test, i = Math.floor((x - T.ox) / T.p), j = Math.floor((y - T.y) / T.p), inside = i >= 0 && j >= 0 && i < T.N && j < T.N;
            const skip = st.skipBox && x >= st.skipBox[0] && x <= st.skipBox[2] && y >= st.skipBox[1] && y <= st.skipBox[3];
            st.hov = type === 'leave' ? null : inside ? [i, j] : skip ? 'skip' : null;
            if (type !== 'down') return;
            if (skip) { F.arc.task(st, st.R); st.wake = 1; return; }
            if (!inside || st.solvedAt != null) return;
            st.paint[j][i] ^= 1; st.wake = 0.5;
            if (st.paint.every((q, jj) => q.every((v, ii) => v === T.out[jj][ii]))) st.solvedAt = -1;
        },
        draw(ctx, R, t, C, st, still) {
            st.R = R;
            if (st.born == null) st.born = t;
            if (st.solvedAt === -1) { st.solvedAt = t; st.wake = 2.6; }
            if (st.solvedAt != null && !still && t - st.solvedAt > 1.6) { F.arc.task(st, R); st.born = t; st.wake = 1; }
            const fade = still || st.born < 0 ? 1 : smooth((t - st.born) / 0.6), solved = st.solvedAt != null, live = st.touched;
            const drawGrid = (G, x0, y0, p, a, color = C.ink2) => G.forEach((q, j) => q.forEach((v, i) => F.arc.cell(ctx, C, x0 + i * p, y0 + j * p, p, v, a, color)));
            const arrow = (x, y, a, gap = 3.5, color = C.ink3, size = 1.2) => { ctx.globalAlpha = a; ctx.fillStyle = color; for (let k = -1; k <= 1; k++) ctx.fillRect(x + k * gap - size / 2, y - size / 2, size, size); };
            st.ex.forEach((e) => { drawGrid(e.g, e.x, e.y, e.p, fade * 0.8); arrow(e.x + e.N * e.p + 7, e.y + (e.N * e.p) / 2, fade * 0.6, 2.5); drawGrid(e.out, e.x + e.N * e.p + 14, e.y, e.p, fade * 0.8); });
            const T = st.test;
            drawGrid(T.g, T.x, T.y, T.p, fade);
            const ax = T.x + T.N * T.p + 13, ay = T.y + (T.N * T.p) / 2, hot = st.hov === 'skip';
            arrow(ax, ay, fade * (hot ? 1 : 0.8), 4, hot ? C.ink : C.ink3, hot ? 2 : 1.4);
            st.skipBox = [ax - 12, ay - 10, ax + 12, ay + 10];
            drawGrid(st.paint, T.ox, T.y, T.p, fade, solved ? C.ink : live ? C.accent : C.ink);
            // the grid to fill: a hairline frame; the hovered cell is outlined
            ctx.globalAlpha = fade * (solved ? 0.7 : 0.3); ctx.strokeStyle = solved ? C.ink : C.ink3; ctx.lineWidth = 1;
            ctx.strokeRect(T.ox - 3.5, T.y - 3.5, T.N * T.p + 7, T.N * T.p + 7);
            if (Array.isArray(st.hov) && !solved) { ctx.globalAlpha = 0.5; ctx.strokeStyle = C.ink2; ctx.strokeRect(T.ox + st.hov[0] * T.p + 0.5, T.y + st.hov[1] * T.p + 0.5, T.p - 1, T.p - 1); }
        },
    };
    // Distributions: each scene is a mixture of one to four Gaussians. Every point keeps a fixed latent
    // (a standard-normal draw and a quantile), so from scene to scene the cloud flows smoothly and
    // coherently, as in flow matching; a few transport paths are drawn in the accent.
    F.network = scenes({
        // a gentle sine ease over most of the scene: no long hesitation, no rush in the middle
        bleed: true, period: 16, offset: 12, quick: 2, morph: [0.0, 0.85], ease: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x)),
        title: 'Distributions', note: 'A cloud flows slowly from one mixture of Gaussians to the next; a few transport paths in the accent.',
        build(R, r, n, s) {
            const N = 1500, fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vh = (R.vy1 ?? R.y + R.h) - vy0, W = R.x + R.w - fx;
            const gauss = (q) => { let u = 0, v = 0; while (!u) u = q(); while (!v) v = q(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
            if (!s.latent) { let sd = 1 + Math.floor(Math.random() * 2e9); const q = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); s.latent = Array.from({ length: N }, () => [gauss(q), gauss(q), q()]); }   // fixed per visit
            const K = 1 + Math.floor(r() * 4);
            let comps = Array.from({ length: K }, () => {
                const a = r() * Math.PI, sx = (0.05 + r() * 0.16) * W, sy = (0.06 + r() * 0.16) * vh;
                return { mx: fx + (0.15 + 0.7 * r()) * W, my: vy0 + (0.2 + 0.6 * r()) * vh, c: Math.cos(a), sn: Math.sin(a), sx, sy, w: 0.4 + r() };
            });
            // a target drawn by the reader: a mixture of small round Gaussians along the stroke
            if (s.target && s.target.length > 3) comps = s.target.map(([mx, my]) => ({ mx, my, c: 1, sn: 0, sx: 7, sy: 7, w: 1 }));
            s.target = null;
            const tot = comps.reduce((a, c) => a + c.w, 0); let acc = 0; const cum = comps.map((c) => (acc += c.w / tot));
            const field = s.latent.map(([z1, z2, u]) => {
                const c = comps[cum.findIndex((v) => u <= v)] || comps[K - 1], x1 = z1 * c.sx, y1 = z2 * c.sy;
                return [c.mx + x1 * c.c - y1 * c.sn, c.my + x1 * c.sn + y1 * c.c, 1.1];
            });
            // transport paths: from where a few points were in the previous scene to where they go now
            const prev = s.cur ? s.cur.field : null, lines = {};
            ['p1', 'p2', 'p3', 'p4', 'p5'].forEach((key, k) => {
                const i = Math.floor(r() * N), a = prev ? prev[i] : field[i], b = field[i];
                lines[key] = Array.from({ length: 80 }, (_, q) => { const u = smooth(q / 79); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; });
            });
            return { field, lines };
        },
        lines: {
            p1: { K: 120, spacing: 2.4, style: [1.9, 0.95, 0.0], sweep: 0.5 }, p2: { K: 120, spacing: 2.4, style: [1.6, 0.65, 0.04], sweep: 0.5 },
            p3: { K: 120, spacing: 2.4, style: [1.5, 0.5, 0.08], sweep: 0.5 }, p4: { K: 120, spacing: 2.4, style: [1.4, 0.4, 0.12], sweep: 0.5 },
            p5: { K: 120, spacing: 2.4, style: [1.3, 0.3, 0.16], sweep: 0.5 },
        },
        // drag to draw a target; on release the cloud flows onto it along straight paths
        pointer(type, x, y, s) {
            if (type === 'down') { s.stroke = [[x, y]]; s.hold = true; s.wake = 0.5; }
            else if (type === 'move' && s.stroke) { s.wake = 0.5; const [lx, ly] = s.stroke[s.stroke.length - 1]; if (Math.hypot(x - lx, y - ly) > 5) s.stroke.push([x, y]); }
            else if (type === 'up' && s.stroke) { s.target = s.stroke; s.stroke = null; s.force = true; }
        },
        decorate(ctx, R, C, s) {
            if (!s.stroke) return;
            ctx.fillStyle = C.accent; ctx.globalAlpha = 0.9;
            s.stroke.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); });
        },
    });

    // Flow matching (Lipman et al.): noise flows to data along the marginal velocity field. Each pair of a
    // noise and a data sample is joined by a straight conditional path; averaging those over all data that
    // could explain a point gives the field the particles actually follow: curved paths that never cross.
    // With Gaussian noise and the target as a mixture of small Gaussians the field is exact, so every
    // particle is integrated from its noise sample. The reader scrubs t on the axis below, or draws a
    // target: the cloud returns to noise and flows onto the drawing. A plain click picks a new mixture.
    F.flowmatch = {
        bleed: true,
        title: 'Flow matching', note: 'Particles follow the marginal flow from noise to data; scrub t on the axis, or draw a target.',
        S: 48,
        init(R, rand) {
            const r = rand(17), N = 700, fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = R.vy1 ?? R.y + R.h, W = R.x + R.w - fx;
            const gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
            const st = { r, N, fx, W, vy0, vy1, gauss, t: 1, axis: { y: vy1 + 18, x0: fx + 6, x1: R.x + R.w - 6 } };
            st.noise = { mx: fx + W * 0.5, my: (vy0 + vy1) / 2, ax: W * 0.2, ay: (vy1 - vy0) * 0.24 };
            st.z = Array.from({ length: N }, () => [st.noise.mx + gauss() * st.noise.ax, st.noise.my + gauss() * st.noise.ay]);
            st.u = Array.from({ length: N }, () => [r(), gauss(), gauss()]);
            st.Y = F.flowmatch.mixture(st); st.traj = F.flowmatch.solve(st, st.Y);
            return st;
        },
        mixture(st) {
            const { r, W, fx, vy0, vy1 } = st, vh = vy1 - vy0, K = 1 + Math.floor(r() * 3);
            const comps = Array.from({ length: K }, () => { const a = r() * Math.PI; return { mx: fx + (0.2 + 0.6 * r()) * W, my: vy0 + (0.25 + 0.5 * r()) * vh, c: Math.cos(a), s: Math.sin(a), sx: (0.05 + 0.12 * r()) * W, sy: (0.04 + 0.08 * r()) * vh }; });
            return Array.from({ length: 200 }, () => { const c = comps[Math.floor(r() * K)], a = st.gauss() * c.sx, b = st.gauss() * c.sy; return [c.mx + a * c.c - b * c.s, c.my + a * c.s + b * c.c]; });
        },
        fromStroke(st, stroke) {
            const cum = [0];
            for (let i = 1; i < stroke.length; i++) cum.push(cum[i - 1] + Math.hypot(stroke[i][0] - stroke[i - 1][0], stroke[i][1] - stroke[i - 1][1]));
            const L = cum[cum.length - 1] || 1;
            return Array.from({ length: 200 }, (_, k) => {
                const d = ((k + 0.5) / 200) * L; let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
                const f = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), a = stroke[i - 1], b = stroke[i] || a;
                return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
            });
        },
        // integrate dx/dt = v(x, t) for every particle. Per axis, x0 ~ N(m, a²), x1 | j ~ N(y_j, h²),
        // x_t = (1 − t) x0 + t x1: given component j, x_t ~ N(μ, V) with μ = (1 − t) m + t y_j,
        // V = (1 − t)² a² + t² h², and E[x1 − x0 | x_t, j] = (y_j − m) + (t h² − (1 − t) a²)(x_t − μ) / V.
        // The field is the posterior-weighted mean over j.
        solve(st, Y) {
            const { N, z, noise } = st, S = F.flowmatch.S, h2 = 16, M = Y.length, out = new Float32Array(N * (S + 1) * 2);
            const lw = new Float64Array(M);
            for (let i = 0; i < N; i++) {
                let x = z[i][0], y = z[i][1];
                out[(i * (S + 1)) * 2] = x; out[(i * (S + 1)) * 2 + 1] = y;
                for (let k = 0; k < S; k++) {
                    const t = k / S, dt = 1 / S, s1 = 1 - t;
                    const Vx = s1 * s1 * noise.ax * noise.ax + t * t * h2, Vy = s1 * s1 * noise.ay * noise.ay + t * t * h2;
                    const cx = (t * h2 - s1 * noise.ax * noise.ax) / Vx, cy = (t * h2 - s1 * noise.ay * noise.ay) / Vy;
                    let mx = -Infinity;
                    for (let j = 0; j < M; j++) { const ex = x - s1 * noise.mx - t * Y[j][0], ey = y - s1 * noise.my - t * Y[j][1]; lw[j] = -0.5 * (ex * ex / Vx + ey * ey / Vy); if (lw[j] > mx) mx = lw[j]; }
                    let ws = 0, vx = 0, vy = 0;
                    for (let j = 0; j < M; j++) {
                        const w = Math.exp(lw[j] - mx); if (w < 1e-6) continue;
                        const ex = x - s1 * noise.mx - t * Y[j][0], ey = y - s1 * noise.my - t * Y[j][1];
                        ws += w; vx += w * (Y[j][0] - noise.mx + cx * ex); vy += w * (Y[j][1] - noise.my + cy * ey);
                    }
                    x += (vx / ws) * dt; y += (vy / ws) * dt;
                    out[(i * (S + 1) + k + 1) * 2] = x; out[(i * (S + 1) + k + 1) * 2 + 1] = y;
                }
            }
            return out;
        },
        vel(st, x, y, t) {
            const { noise } = st, Y = st.Y, h2 = 16, s1 = 1 - t;
            const Vx = s1 * s1 * noise.ax * noise.ax + t * t * h2, Vy = s1 * s1 * noise.ay * noise.ay + t * t * h2;
            const cx = (t * h2 - s1 * noise.ax * noise.ax) / Vx, cy = (t * h2 - s1 * noise.ay * noise.ay) / Vy;
            let mx = -Infinity; const lw = Y.map((q) => { const ex = x - s1 * noise.mx - t * q[0], ey = y - s1 * noise.my - t * q[1], l = -0.5 * (ex * ex / Vx + ey * ey / Vy); if (l > mx) mx = l; return l; });
            let ws = 0, vx = 0, vy = 0;
            Y.forEach((q, j) => { const w = Math.exp(lw[j] - mx); if (w < 1e-6) return; const ex = x - s1 * noise.mx - t * q[0], ey = y - s1 * noise.my - t * q[1]; ws += w; vx += w * (q[0] - noise.mx + cx * ex); vy += w * (q[1] - noise.my + cy * ey); });
            return [vx / ws, vy / ws];
        },
        at(st, traj, i, T) {                                                           // a particle's position at time T
            const S = F.flowmatch.S, f = T * S, k = Math.min(S - 1, Math.floor(f)), u = f - k, o = (i * (S + 1) + k) * 2;
            return [traj[o] + (traj[o + 2] - traj[o]) * u, traj[o + 1] + (traj[o + 3] - traj[o + 1]) * u];
        },
        pointer(type, x, y, st) {
            const A = st.axis, onAxis = Math.abs(y - A.y) < 12 && x > A.x0 - 10;
            const tAt = (px) => Math.max(0, Math.min(1, (px - A.x0) / (A.x1 - A.x0)));
            st.hoverAxis = type !== 'leave' && (onAxis || st.mode === 'scrub');
            if (type === 'down') {
                st.anim = null; if (st.next) { st.traj = st.next; st.Y = st.nextY; st.next = null; }
                if (onAxis) { st.mode = 'scrub'; st.t = tAt(x); } else { st.mode = 'draw'; st.stroke = [[x, y]]; }
                st.wake = 0.5;
            } else if (type === 'move' && st.mode === 'scrub') { st.t = tAt(x); st.wake = 0.5; }
            else if (type === 'move' && st.mode === 'draw') { const [lx, ly] = st.stroke[st.stroke.length - 1]; if (Math.hypot(x - lx, y - ly) > 4) st.stroke.push([x, y]); st.wake = 0.5; }
            else if (type === 'up' && st.mode) {
                if (st.mode === 'draw') {
                    // back to noise along the current flow, then out along the new one
                    st.nextY = st.stroke.length > 4 ? F.flowmatch.fromStroke(st, st.stroke) : F.flowmatch.mixture(st); st.next = F.flowmatch.solve(st, st.nextY);
                    st.anim = { from: st.t, start: null }; st.keepStroke = st.stroke.length > 4 ? st.stroke : null; st.stroke = null; st.wake = 4.5;
                }
                st.mode = null;
            }
        },
        draw(ctx, R, t, C, st, still) {
            const live = st.touched, A = st.axis;
            if (st.anim && !still) {
                const a = st.anim; if (a.start == null) a.start = t;
                const e = t - a.start, back = 0.4 + 0.8 * a.from, fwd = 2.6;
                if (e < back) st.t = a.from * (1 - smooth(e / back));
                else { if (st.next) { st.traj = st.next; st.Y = st.nextY; st.next = null; } st.t = smooth(Math.min(1, (e - back) / fwd)); if (e >= back + fwd) st.anim = null; }
            }
            const T = st.t, S = F.flowmatch.S;
            // a few particles' paths: travelled part solid, the rest faint
            for (let k = 0; k < 9; k++) {
                const i = (k * 97 + 13) % st.N;
                for (let j = 0; j <= S; j++) { const u = j / S, o = (i * (S + 1) + j) * 2; ctx.globalAlpha = u <= T ? (live ? 0.75 : 0.45) : 0.16; ctx.fillStyle = live && u <= T ? C.accent : C.ink3; ctx.fillRect(st.traj[o] - 0.6, st.traj[o + 1] - 0.6, 1.2, 1.2); }
            }
            // the velocity field at this t: short dotted arrows on a lattice, longer where the flow is faster
            const key = `${T.toFixed(3)}|${st.traj.length}`;
            if (st.fieldKey !== key && st.Y) {
                st.fieldKey = key; st.field = [];
                for (let gx = 0; gx < 13; gx++) for (let gy = 0; gy < 7; gy++) { const x = st.fx + 14 + (gx / 12) * (st.W - 28), y = st.vy0 + 6 + (gy / 6) * (st.vy1 - st.vy0 - 12); st.field.push([x, y, ...F.flowmatch.vel(st, x, y, Math.min(0.97, T))]); }
            }
            (st.field || []).forEach(([x, y, vx, vy]) => {
                const m = Math.hypot(vx, vy), L2 = Math.min(13, m * 0.05), ux = vx / (m || 1), uy = vy / (m || 1);
                ctx.fillStyle = C.ink3;
                for (let k = 0; k <= 4; k++) { ctx.globalAlpha = 0.25 + 0.1 * k; ctx.fillRect(x + ux * L2 * (k / 4) - 0.5, y + uy * L2 * (k / 4) - 0.5, 1, 1); }
                ctx.globalAlpha = 0.7; ctx.fillRect(x + ux * L2 - 0.9, y + uy * L2 - 0.9, 1.8, 1.8);
            });
            ctx.fillStyle = C.ink2; ctx.globalAlpha = 0.55;
            for (let i = 0; i < st.N; i++) { const [x, y] = F.flowmatch.at(st, st.traj, i, T); ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4); }
            const stroke = st.stroke || (st.anim ? st.keepStroke : null);
            if (stroke) { ctx.fillStyle = C.accent; ctx.globalAlpha = st.stroke ? 0.9 : 0.35; stroke.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, TAU); ctx.fill(); }); }
            // time axis: dotted, with a handle at t
            slider(ctx, C, st, A.x0, A.x1, A.y, T, `t ${T.toFixed(2)} · noise → data`);
            label(ctx, C, st, 'velocity field v(x, t)', st.fx + 4, st.vy0 + 2);
            if (!still && st.anim) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // Compute-optimal scaling (Chinchilla, Hoffmann et al.): the fitted loss L(N, D) = E + A/N^α + B/D^β,
    // with training compute C ≈ 6ND. Loss against compute, one training curve per model size N; their
    // lower envelope is the compute-optimal frontier. The pointer sets a compute budget (a dotted
    // vertical): on every curve a point slides to that model's loss at the budget, and the best model
    // for it is marked, so sweeping the budget hands the lead to ever larger models. A click trains
    // every size from scratch up to the budget at once, a race the frontier wins.
    F.chinchilla = {
        bleed: true,
        title: 'Compute-optimal scaling', note: 'Training curves of the Chinchilla loss fit; the pointer sets a compute budget, a click races every model size to it.',
        E: 1.69, A: 406.4, B: 410.7, a: 0.34, b: 0.28,
        L(lgN, lgC) { const F2 = F.chinchilla, N = 10 ** lgN, D = 10 ** lgC / (6 * N); return F2.E + F2.A / N ** F2.a + F2.B / D ** F2.b; },
        init(R) {
            const fx = R.fx ?? R.x, x1 = R.x + R.w - 6, vy0 = R.vy0 ?? R.y, vy1 = R.vy1 ?? R.y + R.h;
            const st = { fx, x1, vy0, vy1, c0: 17, c1: 25, l0: 1.85, l1: 4.4, goal: 21.5, c: 21.5, race: null };
            st.X = (lgC) => fx + 6 + ((lgC - st.c0) / (st.c1 - st.c0)) * (x1 - fx - 6);
            st.Y = (L) => vy0 + ((st.l1 - L) / (st.l1 - st.l0)) * (vy1 - vy0);
            st.sizes = []; for (let n = 7; n <= 12.01; n += 0.5) st.sizes.push(n);
            // the frontier, once
            st.front = []; for (let c = st.c0; c <= st.c1; c += 0.05) { let lo = Infinity; for (let n = 6.5; n <= 12.5; n += 0.05) lo = Math.min(lo, F.chinchilla.L(n, c)); st.front.push([c, lo]); }
            return st;
        },
        pointer(type, x, y, st) {
            if (type === 'leave') return;
            st.goal = Math.max(st.c0 + 0.2, Math.min(st.c1, st.c0 + ((x - st.fx - 6) / (st.x1 - st.fx - 6)) * (st.c1 - st.c0)));
            st.wake = 1;
            if (type === 'down') { st.race = { start: null, to: st.goal }; st.wake = 2.6; }
        },
        draw(ctx, R, t, C, st, still) {
            const live = st.touched, inY = (yy) => yy >= st.vy0 - 4 && yy <= st.vy1 + 4;
            const dt = Math.min(0.1, Math.max(0, t - (st.tl ?? t))); st.tl = t;
            st.c = still ? st.goal : st.c + (st.goal - st.c) * Math.min(1, dt * 8);              // the budget eases after the pointer
            let raceAt = null;
            if (st.race && !still) { if (st.race.start == null) st.race.start = t; const u = (t - st.race.start) / 2; raceAt = st.c0 + smooth(Math.min(1, u)) * (st.race.to - st.c0); if (u >= 1.3) st.race = null; }
            const budget = raceAt ?? st.c;
            // training curves, faint; the part trained within the budget a little stronger
            st.sizes.forEach((n) => {
                for (let c = st.c0; c <= st.c1; c += 0.04) {
                    const yy = st.Y(F.chinchilla.L(n, c)); if (!inY(yy)) continue;
                    ctx.globalAlpha = c <= budget ? 0.55 : 0.25; ctx.fillStyle = C.ink3; ctx.fillRect(st.X(c) - 0.6, yy - 0.6, 1.2, 1.2);
                }
            });
            // the frontier
            ctx.fillStyle = C.ink2;
            st.front.forEach(([c, l]) => { const yy = st.Y(l); if (inY(yy)) { ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(st.X(c), yy, 0.9, 0, TAU); ctx.fill(); } });
            // the budget line and each model's point on it; the best one marked
            const bx = st.X(budget);
            ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.6;
            for (let y = st.vy0 - 4; y <= st.vy1 + 4; y += 4) ctx.fillRect(bx - 0.5, y, 1, 1);
            let best = null;
            st.sizes.forEach((n) => { const l = F.chinchilla.L(n, budget); if (!best || l < best[1]) best = [n, l]; });
            st.sizes.forEach((n) => {
                const l = F.chinchilla.L(n, budget), yy = st.Y(l); if (!inY(yy)) return;
                const win = n === best[0];
                ctx.globalAlpha = win ? 1 : 0.7; ctx.fillStyle = win ? (live ? C.accent : C.ink) : C.ink2;
                ctx.beginPath(); ctx.arc(bx, yy, win ? 3 : 1.6, 0, TAU); ctx.fill();
            });
            // the winner's curve up to the budget
            if (best) {
                ctx.fillStyle = live ? C.accent : C.ink;
                for (let c = st.c0; c <= budget; c += 0.025) { const yy = st.Y(F.chinchilla.L(best[0], c)); if (!inY(yy)) continue; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(st.X(c), yy, 0.9, 0, TAU); ctx.fill(); }
            }
            if (!still && (st.race || Math.abs(st.goal - st.c) > 0.002)) st.wake = Math.max(st.wake || 0, 0.2);
        },
    };

    // Multi-head attention: four heads over one causal sequence, each with its own job (local, previous
    // token, the first token as a sink, and content: earlier tokens of the same kind). One row per head:
    // its attention matrix (a lower triangle of points) on the left, and on the right the arcs from the
    // query to every earlier token, point size by weight. The query's matrix row and its arcs are the same
    // numbers. Browse the tokens by pointing at the row or a matrix row, or with the arrow keys.
    F.heads = {
        bleed: true,
        title: 'Attention heads', note: 'Four heads over one sequence (local, previous token, first token, content): matrix and arcs side by side; browse the tokens.',
        init(R, rand) {
            const r = rand(29), T = 14, kinds = Array.from({ length: T }, () => Math.floor(r() * 4));
            const fx = R.fx ?? R.x, vy0 = (R.vy0 ?? R.y) + 2, vy1 = R.vy1 ?? R.y + R.h, W = R.x + R.w - fx - 8;
            const softmax = (v) => { const m = Math.max(...v), e = v.map((x) => Math.exp(x - m)), s2 = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s2); };
            const score = [
                (q, k) => -1.6 * (q - k),                                   // local
                (q, k) => (k === q - 1 ? 5 : 0),                             // previous token
                (q, k) => (k === 0 ? 3.2 : 0) + 0.15 * r(),                  // first token (sink)
                (q, k) => (kinds[k] === kinds[q] && k < q ? 3.5 : 0),        // content
            ];
            const weights = score.map((f) => Array.from({ length: T }, (_, q) => softmax(Array.from({ length: q + 1 }, (_, k) => f(q, k)))));
            const lane = (vy1 - vy0 + 12) / 4, m = Math.floor(lane - 1), ax0 = fx + m + 22, ax1 = fx + W - 4;   // matrices nearly fill each head's row
            return { T, kinds, weights, fx, vy0: vy0 - 6, vy1, W, lane, m, ax0, ax1, q: T - 1, shown: T - 1, field: fieldOf(R, r, 320) };
        },
        pointer(type, x, y, st) {
            let q = null;
            if (type === 'key') q = st.q + (x[0] || x[1]);
            else if (type === 'move' || type === 'down') {
                if (x >= st.ax0 - 10) q = Math.round(((x - st.ax0) / (st.ax1 - st.ax0)) * (st.T - 1));       // the token row
                else { const h = Math.floor((y - st.vy0) / st.lane), top = st.vy0 + h * st.lane + (st.lane - st.m) / 2; q = Math.floor((y - top) / (st.m / st.T)); }   // a matrix row
            }
            if (q == null) return;
            q = Math.max(0, Math.min(st.T - 1, q));
            if (q !== st.q) { st.q = q; st.wake = 0.6; }
        },
        draw(ctx, R, t, C, st, still) {
            const { T, weights, fx, vy0, lane, m, ax0, ax1 } = st;
            const dt = Math.min(0.1, Math.max(0, t - (st.tl ?? t))); st.tl = t;
            st.shown = still ? st.q : st.shown + (st.q - st.shown) * Math.min(1, dt * 14);   // the query glides between tokens
            const qf = st.shown, q = Math.round(qf), cell = m / T;
            const xs = (i) => ax0 + (i / (T - 1)) * (ax1 - ax0);
            const dot = (x, y, r2, a, color) => { if (a <= 0.01) return; ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            drawField(ctx, C, st.field);
            for (let h = 0; h < 4; h++) {
                const top = vy0 + h * lane + (lane - m) / 2, base = top + m;
                // the matrix
                for (let r2 = 0; r2 < T; r2++) for (let k = 0; k <= r2; k++) {
                    const wk = weights[h][r2][k], row = r2 === q;
                    const [ox, oy] = jit(h * 31 + r2, k, 0.35), g = grain(r2 + h * 17, k);
                    dot(fx + (k + 0.5) * cell + ox, top + (r2 + 0.5) * cell + oy, Math.max(0.5, Math.sqrt(wk) * cell * (0.48 + 0.14 * g)), row ? 1 : (0.2 + 0.55 * Math.sqrt(wk)) * (0.8 + 0.2 * g), row ? C.ink : C.ink2);
                }
                dotRect(ctx, fx - 2, top + qf * cell - 1, (q + 1) * cell + 4, cell + 2, 2.4, 1, C.ink, 0.75);
                // a dotted lead from the matrix row to the token row
                ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.5;
                for (let x = fx + m + 4; x < ax0 - 6; x += 3) ctx.fillRect(x, top + (qf + 0.5) * cell - 0.5, 1, 1);
                // the token row and the arcs
                for (let i = 0; i < T; i++) { const [ox, oy] = jit(h, i, 0.5); dot(xs(i) + ox, base + oy, i === q ? 2.4 : 1.1 + 0.4 * grain(h, i), i === q ? 1 : i <= q ? 0.7 : 0.3, i === q ? C.ink : C.ink2); }
                const xq = ax0 + (qf / (T - 1)) * (ax1 - ax0);
                for (let k = 0; k < q; k++) {
                    const wk = weights[h][q][k]; if (wk < 0.02) continue;
                    const xa = xs(k), hgt = Math.min(m - 4, (xq - xa) * 0.4 + 5), n = Math.max(6, Math.round((xq - xa) / 4));
                    for (let j = 1; j < n; j++) { const u = j / n, v = 1 - u, [ox, oy] = jit(h * 97 + k, j, 0.45), x = v * xq + u * xa + ox, y = base - 4 * hgt * u * v + oy; dot(x, y, (0.5 + 1.3 * wk) * (0.85 + 0.3 * grain(k, j)), 0.15 + 0.85 * wk, wk > 0.3 ? C.ink : C.ink3); }
                }
            }
            if (!still && Math.abs(st.shown - st.q) > 0.01) st.wake = Math.max(st.wake || 0, 0.2);
        },
    };

    // labels: small mono text a figure shows only while the pointer is over it
    let MONO = null;

    // The rules kit (the rules page): figures draw only through these. One primitive, the point (radius u·2^k, tone
    // 2^−k ink); a line is joined points (width u·2^k); dotted is points spaced four radii; a field is points on a lattice.
    // Spacing is in quarter lines; durations are beats τ·2^k.
    const K = {
        U: 1.2, LN: 24, TB: 0.12, fade: 1,
        r(k) { return K.U * 2 ** k; },
        pt(ctx, C, x, y, k, tone) { const rr = K.r(k); ctx.globalAlpha = tone * K.fade; ctx.fillStyle = C.ink; if (rr < 1.4) { ctx.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); return; } ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); },
        line(ctx, C, pts, k, tone, close) { if (pts.length < 2) return; ctx.globalAlpha = tone * K.fade; ctx.strokeStyle = C.ink; ctx.lineWidth = K.r(k); ctx.setLineDash([]); ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (close) ctx.closePath(); ctx.stroke(); },
        // points along a polyline, one every four radii, by arc length
        dotted(ctx, C, pts, k, tone) { const step = 4 * K.r(k); let carry = 0; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay); let d = carry; while (d <= L) { K.pt(ctx, C, ax + ((bx - ax) * d) / L, ay + ((by - ay) * d) / L, k, tone); d += step; } carry = d - L; } },
        circle(cx, cy, rr, n = 48) { return Array.from({ length: n }, (_, i) => [cx + rr * Math.cos((i / n) * TAU), cy + rr * Math.sin((i / n) * TAU)]); },
        rect(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; },
        q(v) { return Math.round(v / (K.LN / 4)) * (K.LN / 4); },            // snap to a quarter line
        lines(v) { return K.LN * Math.max(1, Math.floor(v / K.LN)); },        // floor to whole lines
        ease: (x) => smooth(Math.max(0, Math.min(1, x))),
        // read the numbers from the page (the rules page can change them); px via a probe, τ in ms
        sync() { if (typeof document === 'undefined' || !document.body) return; const pr = K._probe || (K._probe = Object.assign(document.createElement('i'), { style: 'position:absolute;visibility:hidden;height:0' })); if (!pr.parentNode) document.body.appendChild(pr);
            pr.style.width = 'var(--line)'; K.LN = pr.offsetWidth || 24; pr.style.width = 'calc(var(--u) * 100)'; K.U = (pr.offsetWidth || 120) / 100;
            K.TB = tauMs(getComputedStyle(document.documentElement).getPropertyValue('--tau')) / 1000;
            const m = getComputedStyle(document.documentElement).getPropertyValue('--ease').match(/cubic-bezier\(([^)]*)\)/); if (m) { const v = m[1].split(',').map(Number); if (v.length === 4 && v.every((n) => !isNaN(n))) EASE = v; } },
        // panels: one height for all (a multiple of three lines, so 4:3 widths are whole lines, at most twelve lines),
        // a line apart, the group centred in the figure's columns and in the head, half a line kept above and below
        panels(R, aspects, opts = {}) {
            const fx = R.fx ?? R.x, right = R.x + R.w, W = right - fx, vy0 = R.vy0 ?? R.y, vy1 = R.vy1 ?? R.y + R.h, L = K.LN;
            const sum = aspects.reduce((a, b) => a + b, 0), gaps = (aspects.length - 1) * L;
            const hMax = Math.min(vy1 - vy0 - L, (W - gaps - L) / sum, 12 * L);
            const unit = aspects.every((x) => x === 1) ? L : 3 * L, h = opts.h || (hMax >= unit ? unit * Math.floor(hMax / unit) : L * Math.max(1, Math.floor(hMax / L)));   // squares in whole lines, 4:3 in threes
            const ws = aspects.map((a) => Math.round((h * a) / (L / 4)) * (L / 4)), total = ws.reduce((a, b) => a + b, 0) + gaps;
            let x = K.q(fx + (W - total) / 2); const y = K.q(vy0 + (vy1 - vy0 - h) / 2);
            return { h, rects: ws.map((w) => { const r = { x, y, w, h }; x += w + L; return r; }) };
        },
        // a main panel as large as the head allows (squares in whole lines, 4:3 in threes), with a strip of 1–3 lines
        // under it at the same width, a line apart; the group centred in the figure's columns and in the head
        stack(R, aspect, stripLines, opts = {}) {
            const fx = R.fx ?? R.x, right = R.x + R.w, W = right - fx, vy0 = R.vy0 ?? R.y, vy1 = R.vy1 ?? R.y + R.h, L = K.LN;
            const unit = aspect === 1 ? L : 3 * L, hMax = Math.min((W - L) / aspect, vy1 - vy0 - L - (stripLines ? L + stripLines * L : 0), 14 * L);
            const h = opts.h || unit * Math.max(1, Math.floor(hMax / unit)), w = Math.round((h * aspect) / (L / 4)) * (L / 4), sh = stripLines * L;
            const total = h + (stripLines ? L + sh : 0), x = K.q(fx + (W - w) / 2), y = K.q(vy0 + (vy1 - vy0 - total) / 2);
            return { h, main: { x, y, w, h }, strip: stripLines ? { x, y: y + h + L, w, h: sh } : null };
        },
    };
    try { K.sync(); } catch (e) { /* no document (tests) */ }
    // the one slider, in every figure: its label half a line above the track's left end (shown on hover, as all labels),
    // the track a line at context tone, up to the value a line at data tone, the value a focus point; ticks (points at
    // data tone) mark discrete values. A row is one line high, the track three quarters down it
    const slider = (ctx, C, s, x0, x1, y, k, text, ticks = 0) => {
        const xv = x0 + Math.max(0, Math.min(1, k)) * (x1 - x0);
        K.line(ctx, C, [[x0, y], [x1, y]], -1, 0.25); K.line(ctx, C, [[x0, y], [xv, y]], 0, 0.5);
        for (let i = 0; i < ticks; i++) K.pt(ctx, C, x0 + (i / (ticks - 1)) * (x1 - x0), y, -1, 0.5);
        K.pt(ctx, C, xv, y, 1, 1);
        if (text) label(ctx, C, s, text, x0, y - K.LN / 2, 'left', true);
    };
    // the same slider standing up (a scale at a figure's edge): the track from bottom to top, filled from the bottom to the
    // value; its label beside the value
    const vslider = (ctx, C, s, x, yBottom, yTop, k, text, side = 'left') => {
        const yv = yBottom - Math.max(0, Math.min(1, k)) * (yBottom - yTop);
        K.line(ctx, C, [[x, yBottom], [x, yTop]], -1, 0.25); K.line(ctx, C, [[x, yBottom], [x, yv]], 0, 0.5);
        K.pt(ctx, C, x, yv, 1, 1);
        if (text) label(ctx, C, s, text, side === 'left' ? x - K.LN / 2 : x + K.LN / 2, yv, side === 'left' ? 'right' : 'left', true);
    };
    const label = (ctx, C, s, text, x, y, align = 'left', strong = false) => {
        if (!s.hover) return;
        MONO = MONO || (getComputedStyle(document.documentElement).getPropertyValue('--mono').trim() || 'monospace');
        ctx.font = `10px ${MONO}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
        ctx.globalAlpha = 1; ctx.fillStyle = C.bg || '#fff';
        const w = ctx.measureText(text).width, rmax = (ctx.canvas.clientWidth || ctx.canvas.width / (ctx.getTransform().a || 1)) - 4;
        let x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x; if (x0 + w > rmax) { x0 = rmax - w; x = x0; ctx.textAlign = 'left'; }   // kept inside the canvas
        // never on another label: move down a quarter line at a time (up to three times), else leave it out
        const placed = s.__labels || (s.__labels = []), hit = (yy) => placed.some((b) => x0 - 2 < b[2] && x0 + w + 2 > b[0] && yy - 6 < b[3] && yy + 6 > b[1]);
        let tries = 0; while (hit(y) && tries < 3) { y += 12; tries++; } if (hit(y)) { ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; return; }
        placed.push([x0 - 2, y - 6, x0 + w + 2, y + 6]);
        ctx.fillRect(x0 - 2, y - 6, w + 4, 12);                                       // a ground under the words
        ctx.fillStyle = strong ? C.ink : C.ink2; ctx.fillText(text, x, y);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    };

    // hand-set points: a fixed small offset and size per point (hashed from its indices), a faint scattered
    // field behind a figure, and outlines drawn as dots rather than strokes
    const jit = (a, b, amp = 0.7) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453, g = Math.sin(a * 269.5 + b * 183.3) * 43758.5453; return [(h - Math.floor(h) - 0.5) * 2 * amp, (g - Math.floor(g) - 0.5) * 2 * amp]; };
    const grain = (a, b) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
    const fieldOf = (R, r, n) => { const fx = R.fx ?? R.x, out = []; for (let i = 0; i < n; i++) out.push([fx + r() * (R.x + R.w - fx), R.y + r() * R.h, 0.12 + 0.25 * r()]); return out; };
    const drawField = (ctx, C, pts) => { ctx.fillStyle = C.ink3; pts.forEach(([x, y, a]) => { ctx.globalAlpha = a; ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2); }); };
    const dotRect = (ctx, x, y, w, h, step, size, color, alpha) => { ctx.globalAlpha = alpha; ctx.fillStyle = color; const n = (L) => Math.max(1, Math.round(L / step)); for (let i = 0; i <= n(w); i++) { const px = x + (i / n(w)) * w; ctx.fillRect(px - size / 2, y - size / 2, size, size); ctx.fillRect(px - size / 2, y + h - size / 2, size, size); } for (let j = 1; j < n(h); j++) { const py = y + (j / n(h)) * h; ctx.fillRect(x - size / 2, py - size / 2, size, size); ctx.fillRect(x + w - size / 2, py - size / 2, size, size); } };

    // The KL-regularized policy of RL fine-tuning (as derived in DPO, Rafailov et al.):
    // π*(y) ∝ π_ref(y) · exp(r(y) / β). Columns are candidate answers; their height in points is the
    // policy's probability, a tick marks the base model's. Marks below say whether a verifier rewards the
    // answer. The pointer's height sets β (high: small β, the policy collapses onto rewarded answers the
    // base already liked; low: it stays near the base); a click flips an answer's reward. After every
    // change a few samples fall into their columns.
    F.klpolicy = {
        bleed: true,
        title: 'KL-regularized policy', note: 'π ∝ π_ref · exp(r/β): move to set β, click an answer to reward it; samples fall into the columns.',
        init(R, rand) {
            const r = rand(31), N = 22, fx = R.fx ?? R.x, vy0 = (R.vy0 ?? R.y) + 6, vy1 = (R.vy1 ?? R.y + R.h) - 16, W = R.x + R.w - fx - 8;
            // the base model: a few broad modes
            const modes = Array.from({ length: 3 }, () => [1 + r() * (N - 2), 1 + r() * 1.8, 0.4 + r()]);   // a few distinct modes
            const raw = Array.from({ length: N }, (_, i) => 0.03 + modes.reduce((a, [m, sd, w]) => a + w * Math.exp(-((i - m) ** 2) / (2 * sd * sd)), 0));
            const Z = raw.reduce((a, b) => a + b, 0), ref = raw.map((v) => v / Z);
            // rewarded answers: a few, mostly where the base puts little mass (so RL has to move it)
            const reward = ref.map(() => 0); let k = 0; while (k < 3) { const i = Math.floor(r() * N); if (!reward[i]) { reward[i] = 1; k++; } }
            const st = { N, ref, reward, fx, vy0, vy1, W, lb: Math.log(1.2), shown: null, drops: [], r, K: 230, pts: null };
            st.pi = F.klpolicy.policy(st);
            return st;
        },
        policy(st) { const b = Math.exp(st.lb), w = st.ref.map((p, i) => p * Math.exp(st.reward[i] / b)), Z = w.reduce((a, c) => a + c, 0); return w.map((v) => v / Z); },
        col(st, i) { return st.fx + 6 + (i + 0.5) * ((st.W - 12) / st.N); },
        sample(st, t) {
            for (let k = 0; k < 6; k++) {
                let u = st.r(), i = 0; while (i < st.N - 1 && (u -= st.pi[i]) > 0) i++;
                st.drops.push({ i, t0: t + k * 0.09 + st.r() * 0.05 });
            }
            if (st.drops.length > 60) st.drops.splice(0, st.drops.length - 60);
        },
        pointer(type, x, y, st) {
            if (type === 'leave') return;
            // height → log β, from 0.05 (top) to 5 (bottom)
            const u = Math.max(0, Math.min(1, (y - st.vy0) / (st.vy1 - st.vy0)));
            st.lb = Math.log(0.05) + u * (Math.log(5) - Math.log(0.05));
            if (type === 'down') {
                const i = Math.max(0, Math.min(st.N - 1, Math.floor(((x - st.fx - 6) / (st.W - 12)) * st.N)));
                st.reward[i] ^= 1;
            }
            st.pi = F.klpolicy.policy(st); st.wantSample = true; st.wake = 1.6;
        },
        draw(ctx, R, t, C, st, still) {
            const { N, fx, vy0, vy1, W } = st, cw = (W - 12) / N, live = st.touched;
            const dt = Math.min(0.1, Math.max(0, t - (st.tl ?? t))); st.tl = t;
            if (st.wantSample && !still) { st.wantSample = false; if (!st.lastSample || t - st.lastSample > 0.5) { F.klpolicy.sample(st, t); st.lastSample = t; } }
            const base = vy1, K = st.K, per = 5, gx = Math.min(3.8, (cw - 3) / per), gy = 3.4;
            const hOf = (p) => Math.ceil((p * K) / per) * gy;                                      // the height of a pile of p·K points
            // the policy as K points in piles: counts by largest remainder, slots filled bottom-up, four abreast
            const counts = st.pi.map((p) => Math.floor(p * K)); let rest = K - counts.reduce((a2, c) => a2 + c, 0);
            st.pi.map((p, i) => [p * K - Math.floor(p * K), i]).sort((a2, b2) => b2[0] - a2[0]).slice(0, rest).forEach(([, i]) => counts[i]++);
            const slots = []; counts.forEach((c, i) => { const x0 = st.fx + 6 + (i + 0.5) * cw - ((per - 1) * gx) / 2; for (let k = 0; k < c; k++) slots.push([x0 + (k % per) * gx, base - Math.floor(k / per) * gy, i]); });
            if (!st.pts) st.pts = slots.map(([x, y]) => ({ x, y }));
            // when the piles change, match points to slots in order across the row, so each moves as little as it can
            const sig = counts.join(',');
            if (sig !== st.sig) {
                st.sig = sig;
                const order = st.pts.map((q, k) => k).sort((a2, b2) => st.pts[a2].x - st.pts[b2].x || st.pts[b2].y - st.pts[a2].y);
                order.forEach((k, j) => { const q = st.pts[k], [tx, ty, i] = slots[j]; q.tx = tx; q.ty = ty; q.i = i; });
            }
            let moving = false;
            st.pts.forEach((q) => {
                if (still) { q.x = q.tx; q.y = q.ty; }
                else { q.x += (q.tx - q.x) * Math.min(1, dt * 6); q.y += (q.ty - q.y) * Math.min(1, dt * 6); if (Math.abs(q.tx - q.x) + Math.abs(q.ty - q.y) > 0.3) moving = true; }
                ctx.globalAlpha = st.reward[q.i] ? 0.9 : 0.6; ctx.fillStyle = st.reward[q.i] ? C.ink : C.ink2;
                ctx.beginPath(); ctx.arc(q.x, q.y, 0.95, 0, TAU); ctx.fill();
            });
            for (let i = 0; i < N; i++) {
                const x = st.fx + 6 + (i + 0.5) * cw;
                // the base model's pile height: a short dotted dash
                const hr = hOf(st.ref[i]); ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.75;
                for (let j = -2; j <= 2; j++) ctx.fillRect(x + j * cw * 0.14 - 0.6, base - hr - 0.6 + gy / 2, 1.2, 1.2);
                // the verifier's mark: a small cluster when rewarded, a ring of points when not
                const my = base + 10;
                if (st.reward[i]) { ctx.fillStyle = C.ink; ctx.globalAlpha = 0.95; [[0, 0], [-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].forEach(([a2, b2]) => { ctx.beginPath(); ctx.arc(x + a2, my + b2, 0.95, 0, TAU); ctx.fill(); }); }
                else { ctx.fillStyle = C.ink2; ctx.globalAlpha = 0.8; for (let j = 0; j < 7; j++) { const a2 = (j / 7) * TAU; ctx.fillRect(x + Math.cos(a2) * 2.6 - 0.5, my + Math.sin(a2) * 2.6 - 0.5, 1, 1); } }
            }
            // β: a dotted scale at the right edge with a handle
            const ax = fx + W - 2, u = (st.lb - Math.log(0.05)) / (Math.log(5) - Math.log(0.05)), hy = vy0 + u * (vy1 - vy0);
            vslider(ctx, C, st, ax, vy1, vy0, 1 - u, `β ${Math.exp(st.lb).toFixed(2)}`);
            // samples falling into their columns
            let falling = false;
            st.drops = st.drops.filter((d) => {
                const e = still ? 1 : (t - d.t0) / 0.7; if (e < 0) { falling = true; return true; } if (e > 1.6) return false;
                const x = F.klpolicy.col(st, d.i), y = vy0 - 6 + Math.min(1, e) ** 2 * (base - vy0 - hOf(st.pi[d.i]) - 4 + 6);
                ctx.globalAlpha = e < 1 ? 1 : 1 - (e - 1) / 0.6; ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill();
                if (e < 1.6) falling = true; return true;
            });
            if (!still && (falling || moving)) st.wake = Math.max(st.wake || 0, 0.25);
        },
    };

    // Folding space (after Montúfar et al., and Welch Labs' pictures of it): a deep ReLU network bends the plane layer by
    // layer. Each layer stretches and rotates the plane (z ↦ Az + b), then folds it onto its positive quadrant (a ReLU
    // pair per axis computes |h|), so after enough layers two tangled classes sit on either side of one straight line. The
    // weights are trained (Adam on the logistic loss), so the folds fit whatever distribution is given: click the input
    // for another dataset (ring, xor, checkerboard, wave, two blobs, band, three rings, spiral), or paint classes onto it
    // with a drag, and the network retrains live from where it is. The row under the input sets the depth (1–8 layers;
    // trained layers are kept, new ones added, and it retrains): the input shows the network's linear regions (the zero
    // line of every unit, before its fold, traced by marching squares) and counts them, the number Montúfar et al. show
    // grows exponentially with depth. Click the right to play the layers; drag across it to scrub.
    F.fold = {
        bleed: true, L: 4, STEPS: 700, PER: 60, LR: 0.03, SIM: 0.05,
        title: 'Folding space', note: 'A trained ReLU network folds, stretches and rotates the plane until two tangled classes sit on either side of a line; deeper networks cut the plane into many more linear regions.',
        // a new shape each time: a family, its parameters drawn within what four layers can fold apart
        shape(r) {
            const rot = r() * TAU, pick = Math.floor(r() * 6), turn = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
            if (pick === 0) { const w = 0.3 + r() * 0.06, k = 3 + Math.floor(r() * 3), amp = r() * 0.05; return { name: 'rings', f: (x, y) => { const t = Math.atan2(y, x); return Math.floor((Math.hypot(x, y) + amp * Math.cos(k * t + rot)) / w) % 2 === 0; } }; }
            if (pick === 1) { const k = 6 + r() * 2; return { name: 'spiral', f: (x, y) => Math.sin(Math.atan2(y, x) + rot - k * Math.hypot(x, y)) > 0 }; }
            if (pick === 2) { const a = (r() - 0.5) * 0.3; return { name: 'checkerboard', f: (x, y) => { const [u, v] = turn(x, y, a); return (Math.floor((u + 1) * 2) + Math.floor((v + 1) * 2)) % 2 === 0; } }; }
            if (pick === 3) { const n = 4 + Math.floor(r() * 3), d = 0.15 + r() * 0.1; return { name: `star · ${n} points`, f: (x, y) => Math.hypot(x, y) < 0.5 + d * Math.cos(n * Math.atan2(y, x) + rot) }; }
            if (pick === 4) { const n = 3 + Math.floor(r() * 3); return { name: `flower · ${n} petals`, f: (x, y) => { const q = Math.hypot(x, y); return q < 0.7 && Math.cos(n * Math.atan2(y, x) + rot) > 0.2 - q; } }; }
            return { name: 'moons', f: (x0, y0) => { const [x, y] = turn(x0, y0, rot), a = Math.hypot(x + 0.25, y + 0.1), b = Math.hypot(x - 0.25, y - 0.1); return (a > 0.35 && a < 0.65 && y > -0.1) || (b > 0.35 && b < 0.65 && y < 0.1); } };
        },
        LMIN: 1, LMAX: 8,
        init(R, rand) {
            const r = rand(37), fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = (R.vy1 ?? R.y + R.h) - 16, W = R.x + R.w - fx;
            // two square panels by the layout rule; the plane [−1, 1] inside a half-line margin, its lattice a half line apart
            const LN = K.LN, lay = K.panels(R, [1, 1]), side = lay.h, sc = (side - LN) / 2, cy = lay.rects[0].y + side / 2;
            const st = { r, fx, vy0, vy1, W, sc, side, L: F.fold.L, u: F.fold.L, ds: 0, ext: 1.4 };
            st.left = [lay.rects[0].x + side / 2, cy]; st.right = [lay.rects[1].x + side / 2, cy];
            const n = Math.round(sc / (LN / 2)); st.lat = []; for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) st.lat.push([i / n, j / n]);   // the plane: a field, ℓ/2 apart
            st.pts = Array.from({ length: 900 }, () => [r() * 2 - 1, r() * 2 - 1]);
            st.grid = []; for (let i = 0; i <= 8; i++) { const a = -1 + i / 4; for (let k = 0; k <= 48; k++) { const b = -1 + k / 24; st.grid.push([a, b], [b, a]); } }
            st.axis = { x0: st.right[0] - side / 2, x1: st.right[0] + side / 2, y: cy + side / 2 + 0.75 * LN };   // the depth, under the output
            st.lrow = { x0: st.left[0] - side / 2, x1: st.left[0] + side / 2, y: cy + side / 2 + 0.75 * LN };   // the layers, under the input
            F.fold.dataset(st, F.fold.shape(r)); st.prevLab = null; st.train = null;
            // trained before it is shown, off the page's way: started when the browser is first idle, then in ~6 ms chunks
            // that yield to the page between them (waiting for idle time again for each chunk could take minutes on a busy
            // page). The first start reaching 80% is shown, else the best of four
            F.fold.reinit(st); st.acc = F.fold.accuracy(st); st.hidden = true;
            const pre = { tries: 0, steps: 0, best: null }, settle = () => { st.P = pre.best.P.slice(); st.acc = pre.best.a; st.m.fill(0); st.v.fill(0); st.it++; if (st.hidden) { st.hidden = false; st.shownAt = performance.now(); } st.request?.(); };
            const chunk = () => {
                if (st.disposed || st.train) return;   // the reader took over (a click or a paint retrains)
                const t0 = performance.now(); while (performance.now() - t0 < 6 && pre.steps < 4 * F.fold.STEPS) { F.fold.step(st); pre.steps++; }
                if (pre.steps < 4 * F.fold.STEPS) { setTimeout(chunk, 0); return; }
                const a = F.fold.accuracy(st), better = !pre.best || a > pre.best.a; if (better) pre.best = { a, P: st.P.slice() };
                pre.tries++;
                if (pre.best.a >= 0.8 || pre.tries >= 4) { settle(); return; }   // the shown weights are never trained on afterwards
                F.fold.reinit(st); pre.steps = 0; setTimeout(chunk, 0);
            };
            idle(chunk);
            return st;
        },
        // a new dataset: the points change tone, all at once, over 4τ
        dataset(st, sh) { st.prevLab = st.lab ? st.lab.slice() : null; st.flipT = null; st.shape = sh; st.ds = (st.ds || 0) + 1; st.lab = st.pts.map(([x, y]) => (sh.f(x, y) ? 1 : 0)); },
        // weights near a stretch-and-rotate per layer, then a random readout line
        reinit(st) {
            const r = st.r, P = [];
            for (let k = 0; k < st.L; k++) { const th = (r() - 0.5) * 1.2 + (r() < 0.5 ? 0.6 : -0.6), c = Math.cos(th), sn = Math.sin(th); P.push(1.4 * c, -1.4 * sn, 1.4 * sn, 1.4 * c, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6); }
            P.push(r() - 0.5, r() - 0.5, 0);
            st.P = P; st.m = new Float64Array(P.length); st.v = new Float64Array(P.length); st.it = 0;
        },
        forward(st, p) { const P = st.P; let z0 = p[0], z1 = p[1]; for (let k = 0; k < st.L; k++) { const o = k * 6, h0 = P[o] * z0 + P[o + 1] * z1 + P[o + 4]; z1 = Math.abs(P[o + 2] * z0 + P[o + 3] * z1 + P[o + 5]); z0 = Math.abs(h0); } const z = [z0, z1]; const o = st.L * 6; return P[o] * z[0] + P[o + 1] * z[1] + P[o + 2]; },
        accuracy(st) { let a = 0; st.pts.forEach((p, i) => { if ((F.fold.forward(st, p) > 0) === !!st.lab[i]) a++; }); return a / st.pts.length; },
        // one full-batch Adam step on the logistic loss, backpropagating through the folds
        step(st) {
            // the forward and backward passes in typed buffers, nothing allocated per point (the same arithmetic)
            const L = st.L, P = st.P, n = P.length, N = st.pts.length;
            const buf = st.buf && st.buf.L === L ? st.buf : (st.buf = { L, g: new Float64Array(n), za: new Float64Array(2 * L), sg: new Float64Array(2 * L) }), g = buf.g, za = buf.za, sg = buf.sg;
            g.fill(0);
            for (let i = 0; i < N; i++) {
                const p = st.pts[i]; let z0 = p[0], z1 = p[1];
                for (let k = 0; k < L; k++) { const o = k * 6, h0 = P[o] * z0 + P[o + 1] * z1 + P[o + 4], h1 = P[o + 2] * z0 + P[o + 3] * z1 + P[o + 5]; za[2 * k] = z0; za[2 * k + 1] = z1; sg[2 * k] = Math.sign(h0); sg[2 * k + 1] = Math.sign(h1); z0 = Math.abs(h0); z1 = Math.abs(h1); }
                const o = L * 6, lg = P[o] * z0 + P[o + 1] * z1 + P[o + 2], y = st.lab[i] ? 1 : -1, dl = -y / (1 + Math.exp(y * lg)) / N;
                g[o] += dl * z0; g[o + 1] += dl * z1; g[o + 2] += dl; let e0 = dl * P[o], e1 = dl * P[o + 1];
                for (let k = L - 1; k >= 0; k--) { const q = k * 6, a0 = za[2 * k], a1 = za[2 * k + 1], d0 = e0 * sg[2 * k], d1 = e1 * sg[2 * k + 1]; g[q] += d0 * a0; g[q + 1] += d0 * a1; g[q + 2] += d1 * a0; g[q + 3] += d1 * a1; g[q + 4] += d0; g[q + 5] += d1; e0 = P[q] * d0 + P[q + 2] * d1; e1 = P[q + 1] * d0 + P[q + 3] * d1; }
            }
            const it = ++st.it, lr = F.fold.LR;
            for (let j = 0; j < n; j++) { st.m[j] = 0.9 * st.m[j] + 0.1 * g[j]; st.v[j] = 0.999 * st.v[j] + 0.001 * g[j] * g[j]; P[j] -= (lr * st.m[j] / (1 - 0.9 ** it)) / (Math.sqrt(st.v[j] / (1 - 0.999 ** it)) + 1e-8); }
            // a pull towards similarities (a = d, b = −c): each layer stays a stretch and a rotation, so the bent plane stays two-dimensional
            const ls = lr * F.fold.SIM * 20; for (let k = 0; k < L; k++) { const o = k * 6, e1 = P[o] - P[o + 3], e2 = P[o + 1] + P[o + 2]; P[o] -= ls * e1; P[o + 3] += ls * e1; P[o + 1] -= ls * e2; P[o + 2] -= ls * e2; }
        },
        // a new depth: the trained layers kept, new ones drawn as for a fresh start (or the last ones dropped), the readout kept
        depth(st, L2) {
            if (L2 === st.L) return;
            const r = st.r, P = st.P, out = P.slice(st.L * 6), lay = P.slice(0, Math.min(st.L, L2) * 6);
            for (let k = st.L; k < L2; k++) { const th = (r() - 0.5) * 1.2 + (r() < 0.5 ? 0.6 : -0.6), c = Math.cos(th), sn = Math.sin(th); lay.push(1.2 * c, -1.2 * sn, 1.2 * sn, 1.2 * c, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4); }
            st.P = lay.concat(out); st.L = L2; st.m = new Float64Array(st.P.length); st.v = new Float64Array(st.P.length); st.it = 0; st.u = L2; st.regionsAt = null;
            st.acc = F.fold.accuracy(st); F.fold.retrain(st);
        },
        // the linear regions. Their boundaries are where some unit's input crosses zero (before its fold): each unit's
        // zero line traced over a grid by marching squares, so the lines are the network's own straight pieces. Their
        // number: grid cells labelled by their activation pattern (the sign of every unit), counted as connected patches
        // of one pattern, slivers under three cells left out
        regions(st, G = 96) {
            const L = st.L, P = st.P, m = st.side / 2 / st.sc, V = G + 1, at = (i) => -m + (2 * m * i) / G, H = [];
            for (let k = 0; k < L; k++) H.push(new Float64Array(V * V), new Float64Array(V * V));
            const pat = new Int32Array(G * G);
            for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) { let z0 = at(i), z1 = -at(j); for (let k = 0; k < L; k++) { const o = k * 6, h0 = P[o] * z0 + P[o + 1] * z1 + P[o + 4], h1 = P[o + 2] * z0 + P[o + 3] * z1 + P[o + 5]; H[2 * k][j * V + i] = h0; H[2 * k + 1][j * V + i] = h1; z0 = Math.abs(h0); z1 = Math.abs(h1); } }
            for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { let z0 = at(i + 0.5), z1 = -at(j + 0.5), code = 0; for (let k = 0; k < L; k++) { const o = k * 6, h0 = P[o] * z0 + P[o + 1] * z1 + P[o + 4], h1 = P[o + 2] * z0 + P[o + 3] * z1 + P[o + 5]; code = code * 4 + (h0 > 0 ? 2 : 0) + (h1 > 0 ? 1 : 0); z0 = Math.abs(h0); z1 = Math.abs(h1); } pat[j * G + i] = code; }
            const seen = new Uint8Array(G * G), stack = []; let n = 0;
            for (let s0 = 0; s0 < G * G; s0++) { if (seen[s0]) continue; let size = 0; seen[s0] = 1; stack.push(s0);
                while (stack.length) { const c = stack.pop(), i = c % G, j = (c - i) / G; size++; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a2 = i + di, b2 = j + dj; if (a2 < 0 || b2 < 0 || a2 >= G || b2 >= G) continue; const c2 = b2 * G + a2; if (!seen[c2] && pat[c2] === pat[c]) { seen[c2] = 1; stack.push(c2); } } }
                if (size >= 3) n++; }
            const segs = [];
            H.forEach((h) => { for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
                const c = [h[j * V + i], h[j * V + i + 1], h[(j + 1) * V + i + 1], h[(j + 1) * V + i]], xy = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], cut = [];
                for (let e = 0; e < 4; e++) { const a2 = c[e], b2 = c[(e + 1) % 4]; if ((a2 > 0) !== (b2 > 0)) { const f = a2 / (a2 - b2), p0 = xy[e], p1 = xy[(e + 1) % 4]; cut.push([at(p0[0] + (p1[0] - p0[0]) * f), -at(p0[1] + (p1[1] - p0[1]) * f)]); } }
                for (let e = 0; e + 1 < cut.length; e += 2) segs.push(cut[e], cut[e + 1]);
            } });
            return { n, segs };
        },
        // retrain from the current weights (Adam moments reset); if it stalls, start over from fresh weights
        retrain(st) { st.anim = null; st.m.fill(0); st.v.fill(0); st.it = 0; st.train = { left: F.fold.STEPS, tries: 0 }; st.u = st.L; st.wake = 6; },
        // one layer at stage t ∈ [0, 2]: 0→1 stretches and rotates (z ↦ Az + b), 1→2 folds the negative half of each axis over like a page
        layer(st, k, x, y, t) {
            const P = st.P, o = k * 6, g = smooth(Math.min(1, t)), h0 = P[o] * x + P[o + 1] * y + P[o + 4], h1 = P[o + 2] * x + P[o + 3] * y + P[o + 5];
            const ax = x + (h0 - x) * g, ay = y + (h1 - y) * g;
            if (t <= 1) return [ax, ay];
            const c = Math.cos(Math.PI * smooth(t - 1));
            return [ax < 0 ? ax * c : ax, ay < 0 ? ay * c : ay];
        },
        apply(st, p, u) { let [x, y] = p; for (let k = 0; k < st.L; k++) { const t = Math.max(0, Math.min(2, (u - k) * 2)); if (t <= 0) break; [x, y] = F.fold.layer(st, k, x, y, t); } return [x, y]; },
        pointer(type, x, y, st) {
            const A = st.axis, uAt = (px) => Math.max(0, Math.min(st.L, ((px - A.x0) / (A.x1 - A.x0)) * st.L));
            const toIn = (px, py) => [(px - st.left[0]) / st.sc, -(py - st.left[1]) / st.sc], onIn = (q) => Math.abs(q[0]) <= 1.15 && Math.abs(q[1]) <= 1.15;
            const LR = st.lrow, onRow = Math.abs(y - LR.y) < K.LN / 2 && x > LR.x0 - 10 && x < LR.x1 + 10, Lat = (px) => Math.round(F.fold.LMIN + Math.max(0, Math.min(1, (px - LR.x0) / (LR.x1 - LR.x0))) * (F.fold.LMAX - F.fold.LMIN));
            if (type === 'down' && onRow) { st.rowDrag = true; st.Lpick = Lat(x); st.wake = 1; return; }
            if (st.rowDrag) { if (type === 'move') { st.Lpick = Lat(x); st.wake = 1; } else if (type === 'up' || type === 'leave') { st.rowDrag = false; if (type === 'up') st.Lpick = Lat(x); F.fold.depth(st, st.Lpick); } return; }
            if (type === 'down') {
                const q = toIn(x, y); st.press = { x, y, moved: false, paint: onIn(q) ? null : false };
                if (st.press.paint === null) { let bi = 0, bd = Infinity; st.pts.forEach((p, i) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; bi = i; } }); st.press.to = st.lab[bi] ? 0 : 1; }
            } else if (type === 'move' && st.press) {
                if (Math.hypot(x - st.press.x, y - st.press.y) > 4) st.press.moved = true; st.press.lx = x; st.press.ly = y;
                if (!st.press.moved) return;
                if (st.press.paint !== false) { st.press.paint = true; const q = toIn(x, y); st.pts.forEach((p, i) => { if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.2) st.lab[i] = st.press.to; }); st.train = null; st.acc = F.fold.accuracy(st); st.wake = 0.5; }
                else { st.anim = null; st.u = uAt(x); st.wake = 0.5; }
            } else if (type === 'up' && st.press) {
                const pr = st.press; st.press = null;
                if (pr.paint === true) F.fold.retrain(st);                                                       // painted: refit
                else if (!pr.moved && x > (st.left[0] + st.right[0]) / 2) { st.anim = { start: null }; st.wake = 6; }                       // click on the right: play the network through its layers
                else if (!pr.moved) { F.fold.dataset(st, F.fold.shape(st.r)); st.acc = F.fold.accuracy(st); F.fold.retrain(st); }   // click on the left: a new shape
            }
        },
        draw(ctx, R, t, C, st, still) {
            const sc = st.sc, L = st.L;
            const U = 1.2, TB = 0.12, side = st.side;                     // the mark unit and the beat (s)
            // the layer walk: each half layer (stretch, then fold) is one transition of 4τ, eased
            if (st.anim && !still) { if (st.anim.start == null) st.anim.start = t; const q = (t - st.anim.start) / (4 * TB), k = Math.floor(q); st.u = Math.min(L, (k + smooth(q - k)) / 2); if (k >= 2 * L) { st.u = L; st.anim = null; } }
            // training: a few Adam steps per frame, the points moving as the weights do
            if (st.train && !still) {
                for (let i = 0; i < F.fold.PER && st.train.left > 0; i++, st.train.left--) F.fold.step(st);
                st.acc = F.fold.accuracy(st);
                if (st.train.left <= 0) { if (st.acc < 0.93 && st.train.tries < 3) { const tr = st.train.tries + 1; F.fold.reinit(st); st.train = { left: F.fold.STEPS, tries: tr }; } else st.train = null; }
            }
            const u = st.u, mapped = st.pts.map((p) => F.fold.apply(st, p, u));
            // the output is framed on the points themselves (after the folds they all lie in one quadrant): centred on the
            // cloud, as large as the panel allows from its 3rd to its 97th percentile, following it smoothly through the walk
            const xs = mapped.map((q) => q[0]).sort((a, b) => a - b), ys = mapped.map((q) => q[1]).sort((a, b) => a - b), qn = (a, f) => a[Math.floor((a.length - 1) * f)];
            const vx = (qn(xs, 0.03) + qn(xs, 0.97)) / 2, vy = (qn(ys, 0.03) + qn(ys, 0.97)) / 2, ext = Math.max(0.15, (Math.max(qn(xs, 0.97) - qn(xs, 0.03), qn(ys, 0.97) - qn(ys, 0.03)) / 2) * 1.2);
            if (!st.view || still) st.view = { x: vx, y: vy, e: ext }; else { st.view.x += (vx - st.view.x) * 0.2; st.view.y += (vy - st.view.y) * 0.2; st.view.e += (ext - st.view.e) * 0.2; }
            st.ext = st.view.e;
            const rs = sc / st.view.e, P = (c, q, s2 = sc) => [c[0] + q[0] * s2, c[1] - q[1] * s2], Pout = (q) => [st.right[0] + (q[0] - st.view.x) * rs, st.right[1] - (q[1] - st.view.y) * rs];
            // the one point: size u·2^k, tone 2^−k; under 1.4px a square on the pixel grid
            if (st.hidden) return;
            const fadeIn = Math.min(1, (performance.now() - (st.shownAt || 0)) / (4 * TB * 1000)), fd = smooth(fadeIn);
            if (fadeIn < 1) { st.wake = Math.max(st.wake || 0, 0.1); requestAnimationFrame(() => st.request?.()); }   // the fade runs on frames of its own
            const pt = (x, y, k, tone) => { const rr = U * 2 ** k; ctx.globalAlpha = tone * fd; ctx.fillStyle = C.ink; if (rr < 1.4) { ctx.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); return; } ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); };
            const clipTo = (c) => { ctx.save(); ctx.beginPath(); ctx.rect(c[0] - side / 2, c[1] - side / 2, side, side); ctx.clip(); };
            // the classes: class 1 a data point at half tone, class 0 a field-size point at a quarter; a new dataset re-tones them over 4τ
            if (st.prevLab && st.flipT == null && !still) st.flipT = t;
            const style = (i) => { const c = st.lab[i]; let k = c ? 0 : -1, tone = c ? 0.5 : 0.25; if (st.prevLab && st.flipT != null) { const e = smooth(Math.max(0, Math.min(1, (t - st.flipT) / (4 * TB)))); /* all at once: one change of tone, 4τ */ const c0 = st.prevLab[i]; if (c0 !== c) { tone = (c0 ? 0.5 : 0.25) + (tone - (c0 ? 0.5 : 0.25)) * e; if (e < 0.5) k = c0 ? 0 : -1; } } return [k, tone]; };
            const flipping = st.prevLab && st.flipT != null && t - st.flipT < 4 * TB; if (st.prevLab && st.flipT != null && !flipping) st.prevLab = null;
            // input panel: the plane as a field, the points, and the learned boundary as a line in focus tone
            clipTo(st.left);
            st.lat.forEach((g) => { const [x, y] = P(st.left, g); pt(x, y, -1, 0.25); });
            // the linear regions, recomputed when the weights change: their boundaries a line at u/2, context tone
            const ver = st.it + ':' + st.L + ':' + st.ds; if (st.regionsAt !== ver) { st.reg = F.fold.regions(st); st.regionsAt = ver; }
            { ctx.globalAlpha = 0.25 * fd; ctx.strokeStyle = C.ink; ctx.lineWidth = U / 2; ctx.beginPath(); const sg = st.reg.segs; for (let e = 0; e < sg.length; e += 2) { const [xa, ya] = P(st.left, sg[e]), [xb, yb] = P(st.left, sg[e + 1]); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); } ctx.stroke(); }
            st.pts.forEach((p, i) => { const [x, y] = P(st.left, p), [k, tone] = style(i); pt(x, y, k, tone); });
            {
                const G = 40, m = side / 2 / sc, v = new Float64Array((G + 1) * (G + 1)), at = (i) => -m + (2 * m * i) / G;
                for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) v[j * (G + 1) + i] = F.fold.forward(st, [at(i), at(j)]);
                ctx.globalAlpha = fd; ctx.strokeStyle = C.ink; ctx.lineWidth = U; ctx.beginPath();
                for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
                    const c = [v[j * (G + 1) + i], v[j * (G + 1) + i + 1], v[(j + 1) * (G + 1) + i + 1], v[(j + 1) * (G + 1) + i]], xy = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], cut = [];
                    for (let e = 0; e < 4; e++) { const a2 = c[e], b2 = c[(e + 1) % 4]; if ((a2 > 0) !== (b2 > 0)) { const f = a2 / (a2 - b2), p0 = xy[e], p1 = xy[(e + 1) % 4]; cut.push([at(p0[0] + (p1[0] - p0[0]) * f), at(p0[1] + (p1[1] - p0[1]) * f)]); } }
                    for (let e = 0; e + 1 < cut.length; e += 2) { const [xa, ya] = P(st.left, cut[e]), [xb, yb] = P(st.left, cut[e + 1]); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); }
                }
                ctx.stroke();
            }
            ctx.restore();
            // output panel: the same field and points, bent by the layers so far; at the end, the readout's line
            clipTo(st.right);
            st.lat.forEach((g) => { const [x, y] = Pout(F.fold.apply(st, g, u)); pt(x, y, -1, 0.25); });
            st.pts.forEach((p, i) => { const [x, y] = Pout(mapped[i]), [k, tone] = style(i); pt(x, y, k, tone); });
            const done = smooth((u - (L - 0.15)) / 0.15);
            if (done > 0) { const o = L * 6, w0 = st.P[o], w1 = st.P[o + 1], c0 = st.P[o + 2], nn = w0 * w0 + w1 * w1 || 1, bz = [st.view.x - ((w0 * st.view.x + w1 * st.view.y + c0) / nn) * w0, st.view.y - ((w0 * st.view.x + w1 * st.view.y + c0) / nn) * w1], dd = [-w1 / Math.sqrt(nn), w0 / Math.sqrt(nn)], ex = 3 * st.ext;
                const [xa, ya] = Pout([bz[0] - dd[0] * ex, bz[1] - dd[1] * ex]), [xb, yb] = Pout([bz[0] + dd[0] * ex, bz[1] + dd[1] * ex]);
                ctx.globalAlpha = done * fd; ctx.strokeStyle = C.ink; ctx.lineWidth = U; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke(); }
            ctx.restore();
            // the depth: a slider over the layers (a tick each), the value where the plane is in the walk
            const A = st.axis;
            slider(ctx, C, st, A.x0, A.x1, A.y, u / L, `depth ${u >= L ? L : u.toFixed(1)} of ${L}`, L + 1);
            // labels, on hover only
            label(ctx, C, st, `input · ${st.shape.name}`, st.left[0], st.left[1] - side / 2 - 12, 'center');
            const kk = Math.min(L - 1, Math.floor(u)), stage = st.train ? `training · ${Math.round(st.acc * 100)}%` : u >= L ? `after ${L} folds · the line splits ${Math.round(st.acc * 100)}%` : (u - kk) * 2 < 1 ? `layer ${kk + 1} · stretch` : `layer ${kk + 1} · fold`;
            label(ctx, C, st, stage, st.right[0], st.right[1] - side / 2 - 12, 'center', true);
            // the layers: a slider with a tick a layer
            { const LR = st.lrow, Lv = st.rowDrag ? st.Lpick : st.L; slider(ctx, C, st, LR.x0, LR.x1, LR.y, (Lv - F.fold.LMIN) / (F.fold.LMAX - F.fold.LMIN), `${Lv} layer${Lv > 1 ? 's' : ''} · ${st.reg ? st.reg.n : '–'} linear regions`, F.fold.LMAX - F.fold.LMIN + 1); }
            if (!still && (flipping || st.flipT == null && st.prevLab)) st.wake = Math.max(st.wake || 0, 0.3);
            if (!still && (st.train || st.anim || st.press || Math.abs(st.view.e - ext) > 0.005)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // Epicycles (the Fourier series as 3Blue1Brown draws it): a closed path is a sum of rotating circles, each
    // a frequency. The chain of circles turns and its tip retraces the path. Draw any closed shape and the
    // circles redraw it; drag the scale at the right to use more or fewer circles.
    F.epicycles = {
        bleed: true, N: 256, REV: 7,
        title: 'Epicycles', note: 'A Fourier series as a chain of rotating circles retracing a path; draw a shape, choose how many circles.',
        init(R, rand) {
            const fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = R.vy1 ?? R.y + R.h, W = R.x + R.w - fx;
            const st = { fx, vy0, vy1, W, cx: fx + (W - 30) * 0.5, cy: (vy0 + vy1) / 2, rad: Math.min((W - 30) * 0.36, (vy1 - vy0) * 0.44), K: 18, tau: 0.999, axis: { x: fx + W - 8, y0: vy0 + 6, y1: vy1 - 6 } };
            // the default path: a ring with a wave on it, like a sound wrapped into a circle
            const path = Array.from({ length: F.epicycles.N }, (_, n) => { const th = (n / F.epicycles.N) * TAU, rr = st.rad * (0.74 + 0.16 * Math.sin(6 * th) + 0.07 * Math.cos(11 * th + 1)); return [st.cx + rr * Math.cos(th), st.cy + rr * Math.sin(th)]; });
            F.epicycles.fit(st, path);
            return st;
        },
        fit(st, path) {
            const N = path.length, co = [];
            for (let k = -N / 2; k < N / 2; k++) {
                let re = 0, im = 0;
                for (let n = 0; n < N; n++) { const a = (-TAU * k * n) / N, x = path[n][0] - st.cx, y = path[n][1] - st.cy; re += x * Math.cos(a) - y * Math.sin(a); im += x * Math.sin(a) + y * Math.cos(a); }
                co.push({ k, re: re / N, im: im / N, amp: Math.hypot(re, im) / N });
            }
            co.sort((a, b) => b.amp - a.amp);
            st.co = co; st.path = path; st.curve = null;
        },
        at(st, tau, K) {                                                            // the chain at time τ: centre of each circle, then the tip
            let x = st.cx, y = st.cy; const chain = [[x, y, 0]];
            for (let j = 0; j < K; j++) { const c = st.co[j], a = TAU * c.k * tau; x += c.re * Math.cos(a) - c.im * Math.sin(a); y += c.re * Math.sin(a) + c.im * Math.cos(a); chain.push([x, y, c.amp]); }
            return chain;
        },
        pointer(type, x, y, st) {
            const A = st.axis, Kat = (py) => Math.max(1, Math.round(2 ** ((1 - (py - A.y0) / (A.y1 - A.y0)) * 7)));
            if (type === 'down') { if (x > A.x - 14) { st.mode = 'k'; st.K = Kat(y); st.curve = null; } else { st.mode = 'draw'; st.stroke = [[x, y]]; } st.wake = 0.5; }
            else if (type === 'move' && st.mode === 'k') { st.K = Kat(y); st.curve = null; st.wake = 0.5; }
            else if (type === 'move' && st.mode === 'draw') { const [lx, ly] = st.stroke[st.stroke.length - 1]; if (Math.hypot(x - lx, y - ly) > 3) st.stroke.push([x, y]); st.wake = 0.5; }
            else if (type === 'up' && st.mode) {
                if (st.mode === 'draw' && st.stroke.length > 8) {
                    // resample the drawing (closed) to N points by arc length
                    const s0 = st.stroke.concat([st.stroke[0]]), cum = [0];
                    for (let i = 1; i < s0.length; i++) cum.push(cum[i - 1] + Math.hypot(s0[i][0] - s0[i - 1][0], s0[i][1] - s0[i - 1][1]));
                    const Lt = cum[cum.length - 1], N = F.epicycles.N, path = [];
                    for (let n = 0; n < N; n++) { const d = (n / N) * Lt; let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const f = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); path.push([s0[i - 1][0] + (s0[i][0] - s0[i - 1][0]) * f, s0[i - 1][1] + (s0[i][1] - s0[i - 1][1]) * f]); }
                    st.cx = path.reduce((a, p) => a + p[0], 0) / N; st.cy = path.reduce((a, p) => a + p[1], 0) / N;
                    F.epicycles.fit(st, path); st.K = Math.max(st.K, 24);
                }
                st.tau = 0; st.play = true; st.wake = F.epicycles.REV + 0.3; st.mode = null; st.stroke = null;
            }
        },
        draw(ctx, R, t, C, st, still) {
            const dt = Math.min(0.1, Math.max(0, t - (st.tl ?? t))); st.tl = t;
            if (st.play && !still) { st.tau += dt / F.epicycles.REV; if (st.tau >= 1) { st.tau = 0.999; st.play = false; } }
            const K = Math.min(st.K, st.co.length);
            if (!st.curve) st.curve = Array.from({ length: 400 }, (_, i) => { const c = F.epicycles.at(st, i / 400, K); return c[c.length - 1]; });
            // the original path, faint
            ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.28;
            for (let i = 0; i < st.path.length; i += 2) ctx.fillRect(st.path[i][0] - 0.6, st.path[i][1] - 0.6, 1.2, 1.2);
            // the trace so far
            const upto = Math.floor(st.tau * 400);
            ctx.fillStyle = C.ink;
            for (let i = 0; i < upto; i++) { ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(st.curve[i][0], st.curve[i][1], 0.95, 0, TAU); ctx.fill(); }
            // the chain of circles
            const chain = F.epicycles.at(st, st.tau, K);
            for (let j = 1; j < chain.length; j++) {
                const [x0, y0] = chain[j - 1], [x1, y1, amp] = chain[j];
                if (amp > 1.2) { const n = Math.max(8, Math.round(amp * 1.2)); ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.35; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; ctx.fillRect(x0 + amp * Math.cos(a) - 0.5, y0 + amp * Math.sin(a) - 0.5, 1, 1); } }
                const d = Math.hypot(x1 - x0, y1 - y0), m = Math.max(2, Math.round(d / 3)); ctx.fillStyle = C.ink2; ctx.globalAlpha = 0.8;
                for (let i = 0; i <= m; i++) ctx.fillRect(x0 + ((x1 - x0) * i) / m - 0.6, y0 + ((y1 - y0) * i) / m - 0.6, 1.2, 1.2);
            }
            const [tx, ty] = chain[chain.length - 1];
            ctx.globalAlpha = 1; ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(tx, ty, 2.4, 0, TAU); ctx.fill();
            // the drawing in progress
            if (st.stroke) { ctx.fillStyle = C.ink; ctx.globalAlpha = 0.9; st.stroke.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill(); }); }
            // circles: a log scale at the right with a handle
            const A = st.axis, hy = A.y0 + (1 - Math.log2(st.K) / 7) * (A.y1 - A.y0);
            vslider(ctx, C, st, A.x, A.y1, A.y0, Math.log2(st.K) / 7, `${st.K} circle${st.K > 1 ? 's' : ''}`);
            label(ctx, C, st, 'each circle: one frequency', st.fx + 4, st.vy0 + 2);
            label(ctx, C, st, 'traced path', st.cx, st.vy1 - 2, 'center');
            if (!still && (st.play || st.mode)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // Logits on springs: RL fine-tuning with a KL penalty, as forces. Above, each answer's logit is a stem;
    // a ring marks the base model's logit, and a spring between them is the KL penalty pulling back. Below,
    // the softmax of the logits: the probabilities, as piles of points. A verifier rewards some answers
    // (filled marks). While training, each step pushes rewarded logits up (policy gradient, with the group
    // mean as baseline) against the springs; the pointer's height sets the springs' stiffness β. A click
    // on an answer flips its reward. The logits settle where π ∝ π_ref · exp(r/β).
    F.springs = {
        bleed: true,
        title: 'Logits on springs', note: 'Policy-gradient steps push rewarded logits up against KL springs to the base model; softmax turns logits into probabilities.',
        init(R, rand) {
            const r = rand(41), N = 9, fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = R.vy1 ?? R.y + R.h, W = R.x + R.w - fx - 24;
            const g = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
            const zr = Array.from({ length: N }, () => g() * 0.9);
            const order = zr.map((z, i) => [z, i]).sort((a, b) => a[0] - b[0]);
            const reward = zr.map(() => 0); reward[order[1][1]] = 1; reward[order[4][1]] = 1;            // rewarded answers the base model finds unlikely
            const mid = vy0 + (vy1 - vy0) * 0.42;
            return { N, zr, z: zr.slice(), reward, fx, vy0, vy1, W, mid, lb: Math.log(0.4), train: 0, top: [vy0 + 4, mid - 10], bot: [mid + 12, vy1 - 14] };
        },
        soft(z) { const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s2 = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s2); },
        stepTrain(st, dt) {
            const beta = Math.exp(st.lb);
            for (let it = 0; it < 6; it++) {
                const p = F.springs.soft(st.z), q = F.springs.soft(st.zr), rb = p.reduce((a, pi, i) => a + pi * st.reward[i], 0);
                const kl = p.reduce((a, pi, i) => a + pi * Math.log(pi / q[i]), 0);
                st.z = st.z.map((z, i) => z + 2.2 * dt * (p[i] * (st.reward[i] - rb) - beta * p[i] * (Math.log(p[i] / q[i]) - kl)) * 6);
                const mz = st.z.reduce((a, b) => a + b, 0) / st.N, mr = st.zr.reduce((a, b) => a + b, 0) / st.N;   // logits are shift-free: keep their mean on the base model's
                st.z = st.z.map((z) => z - mz + mr);
            }
        },
        col(st, i) { return st.fx + 6 + (i + 0.5) * ((st.W - 12) / st.N); },
        pointer(type, x, y, st) {
            if (type === 'leave' || type === 'enter') return;
            const u = Math.max(0, Math.min(1, (y - st.vy0) / (st.vy1 - st.vy0)));
            st.lb = Math.log(2) + u * (Math.log(0.08) - Math.log(2));                                // top: stiff springs (large β); bottom: loose
            if (type === 'down') { const i = Math.max(0, Math.min(st.N - 1, Math.floor(((x - st.fx - 6) / (st.W - 12)) * st.N))); st.reward[i] ^= 1; }
            st.train = 4; st.wake = 4.2;
        },
        draw(ctx, R, t, C, st, still) {
            const dt = Math.min(0.05, Math.max(0, t - (st.tl ?? t))); st.tl = t;
            if (!still && st.train > 0) { st.train -= dt; F.springs.stepTrain(st, dt); }
            if (still && !st.touched) { for (let k = 0; k < 400; k++) F.springs.stepTrain(st, 0.03); }  // the rest frame shows the trained policy
            const { N, top, bot } = st, beta = Math.exp(st.lb), p = F.springs.soft(st.z), live = st.touched;
            const zs = (top[1] - top[0]) / 4.2, zero = (top[0] + top[1]) / 2 + 4;                                           // px per logit unit, and the zero line
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.3; for (let x = st.fx; x < st.fx + st.W; x += 4) ctx.fillRect(x - 0.5, zero - 0.5, 1, 1);
            for (let i = 0; i < N; i++) {
                const x = F.springs.col(st, i), yz = Math.max(top[0], Math.min(top[1] + 10, zero - st.z[i] * zs)), yr = Math.max(top[0], Math.min(top[1] + 10, zero - st.zr[i] * zs));
                // the stem from zero to the logit
                const n = Math.round(Math.abs(yz - zero) / 3); for (let k = 0; k <= n; k++) dot(x, zero + ((yz - zero) * k) / Math.max(1, n), 0.7, 0.6, C.ink2);
                // the spring to the base model's logit: coils, tighter for a stiffer β
                const d = yr - yz;
                if (Math.abs(d) > 2) { const coils = 5, amp = 1.5 + Math.min(3, beta * 1.6), m = Math.max(12, Math.round(Math.abs(d) / 1.6)); for (let k = 0; k <= m; k++) { const f = k / m; dot(x + 5 + amp * Math.sin(f * coils * TAU), yz + d * f, 0.55, 0.55, C.ink3); } }
                ctx.globalAlpha = 0.85; ctx.strokeStyle = C.ink3; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + 5, yr, 2.2, 0, TAU); ctx.stroke();
                dot(x, yz, 2.3, 1, st.reward[i] ? C.ink : C.ink2);
                // the probability pile below
                const h = p[i] * (bot[1] - bot[0]) * 1.6, rows = Math.min(Math.floor((bot[1] - bot[0]) / 3), Math.round(h / 3));
                for (let k = 0; k < rows; k++) for (let j = -1; j <= 1; j++) dot(x + j * 3, bot[1] - k * 3, 0.8, st.reward[i] ? 0.85 : 0.5, st.reward[i] ? C.ink : C.ink2);
                // the verifier's mark
                const my = bot[1] + 9;
                if (st.reward[i]) { [[0, 0], [-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].forEach(([a, b]) => dot(x + a, my + b, 0.9, 0.95, C.ink)); }
                else for (let j = 0; j < 7; j++) { const a = (j / 7) * TAU; dot(x + Math.cos(a) * 2.6, my + Math.sin(a) * 2.6, 0.5, 0.8, C.ink2); }
            }
            // softmax: a dotted arrow from logits to probabilities
            const ax = st.fx - 2; ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.6; for (let y = top[1] + 2; y < bot[0] + 4; y += 3) ctx.fillRect(ax - 0.5, y, 1, 1);
            dot(ax - 2, bot[0] + 1, 0.8, 0.7, C.ink3); dot(ax + 2, bot[0] + 1, 0.8, 0.7, C.ink3);
            // β: the spring stiffness, a scale at the right
            const bx = st.fx + st.W + 14, by0 = st.vy0 + 4, by1 = st.vy1 - 4, uu = (Math.log(2) - st.lb) / (Math.log(2) - Math.log(0.08)), hy = by0 + uu * (by1 - by0);
            vslider(ctx, C, st, bx, by1, by0, 1 - uu, `β ${Math.exp(st.lb).toFixed(2)}`);
            label(ctx, C, st, 'logits', st.fx + 4, top[0], 'left', true);
            label(ctx, C, st, 'ring: base model · coil: KL spring', st.fx + st.W, top[0], 'right');
            label(ctx, C, st, 'softmax ↓', ax + 6, (top[1] + 10 + bot[0]) / 2);
            label(ctx, C, st, 'probabilities', st.fx + st.W / 2, bot[0] + 2, 'center', true);
            if (!still && st.train > 0) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // Attention, as 3Blue1Brown draws it: tokens in a row, and their embeddings as arrows in a plane. For a
    // query token, its query is compared with every earlier token's key (dot products, softmaxed into the
    // weights shown above the tokens); the weighted value vectors are then added to the query's embedding,
    // tip to tail, moving it to its updated, in-context meaning. Browse the tokens to watch each update.
    F.attn3b = {
        bleed: true,
        title: 'Attention', note: 'Query · key gives the weights; the weighted values, added tip to tail, move the embedding.',
        init(R, rand) {
            const r = rand(43), T = 7, fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = R.vy1 ?? R.y + R.h, W = R.x + R.w - fx;
            const g = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
            const emb = Array.from({ length: T }, () => { const a = r() * TAU, m = 0.45 + 0.4 * r(); return [m * Math.cos(a), m * Math.sin(a)]; });
            const M = () => [[g(), g()], [g(), g()]], mul = (A, v) => [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];
            const WQ = M(), WK = M(), WV = M();
            const Q = emb.map((e) => mul(WQ, e)), K = emb.map((e) => mul(WK, e)), V = emb.map((e) => mul(WV, e).map((c) => c * 0.35));
            const weights = Q.map((q, j) => { const s2 = K.slice(0, j + 1).map((k) => (q[0] * k[0] + q[1] * k[1]) * 2.2), m = Math.max(...s2), e = s2.map((v) => Math.exp(v - m)), z = e.reduce((a, b) => a + b, 0); return e.map((v) => v / z); });
            const plane = { x: fx + W * 0.76, y: (vy0 + vy1) / 2 - 4, s: Math.min(W * 0.2, (vy1 - vy0) * 0.42) };
            return { T, emb, V, weights, fx, vy0, vy1, W, plane, q: T - 1, since: -1, strip: [fx + 10, fx + W * 0.5] };
        },
        pointer(type, x, y, st) {
            let q = null;
            if (type === 'key') q = st.q + (x[0] || x[1]);
            else if ((type === 'move' || type === 'down') && x < st.strip[1] + 20) q = Math.round(((x - st.strip[0]) / (st.strip[1] - st.strip[0])) * (st.T - 1));
            if (q == null) return;
            q = Math.max(0, Math.min(st.T - 1, q));
            if (q !== st.q) { st.q = q; st.since = null; st.wake = 2; }
        },
        draw(ctx, R, t, C, st, still) {
            if (st.since === null) st.since = t;
            const e = still || st.since < 0 ? 1 : Math.min(1, (t - st.since) / 1.8);
            const { T, emb, V, weights, plane, q } = st, w = weights[q];
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            const P = (v) => [plane.x + v[0] * plane.s, plane.y - v[1] * plane.s];
            const arrow = (a, b, size, alpha, col, upto = 1) => { const [x0, y0] = a, [x1, y1] = [a[0] + (b[0] - a[0]) * upto, a[1] + (b[1] - a[1]) * upto], d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(d / 3)); for (let i = 0; i <= n; i++) dot(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, size, alpha, col); if (upto > 0.05) dot(x1, y1, size + 1, alpha, col); };
            const xs = (i) => st.strip[0] + (i / (T - 1)) * (st.strip[1] - st.strip[0]), base = st.vy1 - 4;
            // the plane: dotted axes, and every token's embedding, faint
            ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.35;
            for (let k = -plane.s * 1.25; k <= plane.s * 1.25; k += 4) { ctx.fillRect(plane.x + k - 0.5, plane.y - 0.5, 1, 1); ctx.fillRect(plane.x - 0.5, plane.y + k - 0.5, 1, 1); }
            emb.forEach((v, i) => arrow(P([0, 0]), P(v), 0.6, i <= q ? 0.4 : 0.15, C.ink3));
            // the weights: a column of points above each earlier token, grown in the first part of the step
            const g1 = smooth(e / 0.35);
            for (let i = 0; i < T; i++) {
                const x = xs(i), on = i <= q;
                dot(x, base, i === q ? 3 : 1.8, on ? (i === q ? 1 : 0.75) : 0.25, i === q ? C.ink : C.ink2);
                if (on) { const n = Math.round(w[i] * 22 * g1); for (let k = 1; k <= n; k++) dot(x, base - 6 - k * 3.2, 0.9, 0.85, C.ink); }
            }
            // the update: from the query's embedding, each weighted value vector added tip to tail
            let tip = emb[q].slice();
            arrow(P([0, 0]), P(tip), 1, 0.9, C.ink2);
            const g2 = (e - 0.3) / 0.5;
            for (let i = 0; i <= q; i++) {
                const f = Math.max(0, Math.min(1, g2 * (q + 1) - i)); if (f <= 0) break;
                const next = [tip[0] + V[i][0] * w[i], tip[1] + V[i][1] * w[i]];
                arrow(P(tip), P(next), 0.7, 0.4 + 0.6 * w[i], C.ink, smooth(f)); tip = f >= 1 ? next : [tip[0] + (next[0] - tip[0]) * smooth(f), tip[1] + (next[1] - tip[1]) * smooth(f)];
            }
            const g3 = smooth((e - 0.8) / 0.2);
            if (g3 > 0) { const [x, y] = P(tip); ctx.globalAlpha = g3; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.stroke(); }
            // a lead from the query token to its embedding
            ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.4; { const [x1, y1] = P(emb[q]), x0 = xs(q), y0 = base - 8; const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 5); for (let i = 1; i < n; i++) ctx.fillRect(x0 + ((x1 - x0) * i) / n - 0.5, y0 + ((y1 - y0) * i) / n - 0.5, 1, 1); }
            label(ctx, C, st, 'tokens', st.strip[0] - 4, base + 1, 'right');
            label(ctx, C, st, 'weights: softmax(query · key)', st.strip[0], st.vy0 + 2);
            label(ctx, C, st, 'embedding', plane.x, plane.y + plane.s * 1.25 + 4, 'center');
            if (g3 > 0) { const [x, y] = P(tip); label(ctx, C, st, '+ weighted values', x + 8, y, 'left', true); }
            if (!still && e < 1) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // A small network learning by backpropagation (Rumelhart, Hinton & Williams), and its lottery tickets
    // (Frankle & Carbin): clicking the network prunes the smallest quarter of the remaining weights, rewinds
    // the rest to their initial values and retrains; the sparse subnetwork fits the data again.
    // The network: 2 → 6 → 6 → 1, tanh
    // units, a sigmoid output, trained by gradient descent on the points in the field. Right: the field as
    // a dot screen (dot size by the network's confidence) with the decision boundary traced where the
    // prediction flips. Left: the network, connections weighted by size; pointing at the field lights the
    // activations for that input. A click adds a point of the class the network currently gets wrong
    // there (a click on a point flips it), and the network trains to fit it.
    F.backprop = {
        bleed: true, SIZES: [2, 6, 6, 1],
        title: 'Backpropagation', note: 'A 2-6-6-1 network trains live on the points; click to add a point it gets wrong, watch the boundary move.',
        init(R, rand) {
            const r = rand(47), fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = (R.vy1 ?? R.y + R.h) + 6, W = R.x + R.w - fx;
            const g = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
            const S = F.backprop.SIZES, net = [];
            for (let l = 1; l < S.length; l++) net.push({ W: Array.from({ length: S[l] }, () => Array.from({ length: S[l - 1] }, () => g() * 0.9)), b: Array.from({ length: S[l] }, () => g() * 0.1) });
            const field = { x0: fx + W * 0.36, x1: fx + W - 6, y0: vy0, y1: vy1 };
            // two interleaved moons
            const data = [];
            for (let i = 0; i < 26; i++) { const a = (i / 25) * Math.PI; data.push([Math.cos(a) * 0.6 - 0.25 + g() * 0.06, Math.sin(a) * 0.7 - 0.2 + g() * 0.06, 1]); data.push([Math.cos(a + Math.PI) * 0.6 + 0.25 + g() * 0.06, Math.sin(a + Math.PI) * 0.7 + 0.25 + g() * 0.06, 0]); }
            const st = { r, fx, vy0, vy1, W, net, field, data, vel: null, train: 0, probe: null };
            st.init0 = net.map((L) => ({ W: L.W.map((row) => row.slice()), b: L.b.slice() }));               // kept for rewinding
            st.mask = net.map((L) => L.W.map((row) => row.map(() => 1)));
            st.netbox = { x0: fx + 8, x1: fx + W * 0.28, y0: vy0 + 8, y1: vy1 - 10 };
            for (let k = 0; k < 2500; k++) F.backprop.step(st);                                     // arrive trained
            return st;
        },
        forward(st, x) {
            const acts = [x];
            st.net.forEach((L, l) => { const prev = acts[acts.length - 1], out = L.W.map((row, j) => row.reduce((a, w, i) => a + w * prev[i], L.b[j])); acts.push(l === st.net.length - 1 ? out.map((z) => 1 / (1 + Math.exp(-z))) : out.map(Math.tanh)); });
            return acts;
        },
        // one step of full-batch gradient descent with momentum on the cross-entropy
        step(st) {
            const grads = st.net.map((L) => ({ W: L.W.map((row) => row.map(() => 0)), b: L.b.map(() => 0) }));
            st.data.forEach(([x, y, c]) => {
                const acts = F.backprop.forward(st, [x, y]);
                let delta = [acts[acts.length - 1][0] - c];                                         // dLoss/dz at the sigmoid output
                for (let l = st.net.length - 1; l >= 0; l--) {
                    const prev = acts[l];
                    delta.forEach((d, j) => { grads[l].b[j] += d; prev.forEach((a, i) => (grads[l].W[j][i] += d * a)); });
                    if (l > 0) delta = prev.map((a, i) => st.net[l].W.reduce((s2, row, j) => s2 + row[i] * delta[j], 0) * (1 - a * a));   // back through tanh
                }
            });
            const n = st.data.length, lr = 0.25, mom = 0.9;
            if (!st.vel) st.vel = grads.map((g2) => ({ W: g2.W.map((row) => row.map(() => 0)), b: g2.b.map(() => 0) }));
            st.net.forEach((L, l) => {
                L.W.forEach((row, j) => row.forEach((w, i) => { if (!st.mask[l][j][i]) { row[i] = 0; return; } st.vel[l].W[j][i] = mom * st.vel[l].W[j][i] - (lr * grads[l].W[j][i]) / n; row[i] += st.vel[l].W[j][i]; }));
                L.b.forEach((b, j) => { st.vel[l].b[j] = mom * st.vel[l].b[j] - (lr * grads[l].b[j]) / n; L.b[j] += st.vel[l].b[j]; });
            });
        },
        prune(st) {
            const alive = [];
            st.net.forEach((L, l) => L.W.forEach((row, j) => row.forEach((w, i) => { if (st.mask[l][j][i]) alive.push([Math.abs(w), l, j, i]); })));
            if (alive.length <= 8) return;
            alive.sort((a, b) => a[0] - b[0]).slice(0, Math.floor(alive.length * 0.25)).forEach(([, l, j, i]) => (st.mask[l][j][i] = 0));
            // rewind the survivors to where they started
            st.net.forEach((L, l) => { L.W.forEach((row, j) => row.forEach((w, i) => (row[i] = st.mask[l][j][i] ? st.init0[l].W[j][i] : 0))); L.b = st.init0[l].b.slice(); });
            st.vel = null; st.pruned = (st.pruned || 0) + 1; st.rewoundAt = null;
        },
        left(st) { let a = 0, n = 0; st.mask.forEach((M) => M.forEach((row) => row.forEach((m) => { n++; a += m; }))); return a / n; },
        toField(st, x, y) { const f = st.field; return [((x - f.x0) / (f.x1 - f.x0)) * 2 - 1, -(((y - f.y0) / (f.y1 - f.y0)) * 2 - 1)]; },
        fromField(st, u, v) { const f = st.field; return [f.x0 + ((u + 1) / 2) * (f.x1 - f.x0), f.y0 + ((1 - v) / 2) * (f.y1 - f.y0)]; },
        pointer(type, x, y, st) {
            if (type === 'leave') { st.probe = null; return; }
            const inField = x >= st.field.x0 - 4;
            if (type === 'move') st.probe = inField ? F.backprop.toField(st, x, y) : null;
            if (type === 'down' && !inField) { F.backprop.prune(st); st.train = 6; st.wake = 6.2; }
            if (type === 'down' && inField) {
                const [u, v] = F.backprop.toField(st, x, y);
                const near = st.data.find((d) => { const [px, py] = F.backprop.fromField(st, d[0], d[1]); return Math.hypot(px - x, py - y) < 7; });
                if (near) near[2] ^= 1;
                else { const p = F.backprop.forward(st, [u, v]).pop()[0]; st.data.push([u, v, p > 0.5 ? 0 : 1]); }
                st.vel = null; st.train = 5; st.wake = 5.2;
            }
            if (type === 'move' || type === 'down') st.wake = Math.max(st.wake || 0, 0.3);
        },
        draw(ctx, R, t, C, st, still) {
            const dt = Math.min(0.05, Math.max(0, t - (st.tl ?? t))); st.tl = t;
            if (!still && st.train > 0) { st.train -= dt; for (let k = 0; k < 12; k++) F.backprop.step(st); }
            const f = st.field, live = st.touched;
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            // the field: a dot screen of the network's prediction
            const NX = 30, NY = 13, P = [];
            for (let j = 0; j <= NY; j++) { P.push([]); for (let i = 0; i <= NX; i++) { const u = (i / NX) * 2 - 1, v = 1 - (j / NY) * 2; P[j].push(F.backprop.forward(st, [u, v]).pop()[0]); } }
            for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
                const p = P[j][i], [x, y] = F.backprop.fromField(st, (i / NX) * 2 - 1, 1 - (j / NY) * 2), c = Math.abs(p - 0.5) * 2;
                dot(x, y, 0.5 + (p > 0.5 ? 1.3 : 0.6) * c, p > 0.5 ? 0.18 + 0.32 * c : 0.12 + 0.18 * c, p > 0.5 ? C.ink2 : C.ink3);
                // the boundary: where the prediction crosses one half between neighbours
                if (i < NX && (P[j][i] - 0.5) * (P[j][i + 1] - 0.5) < 0) { const a = (0.5 - P[j][i]) / (P[j][i + 1] - P[j][i]), [bx] = F.backprop.fromField(st, ((i + a) / NX) * 2 - 1, 0); dot(bx, y, 1.2, 0.9, C.ink); }
                if (j < NY && (P[j][i] - 0.5) * (P[j + 1][i] - 0.5) < 0) { const a = (0.5 - P[j][i]) / (P[j + 1][i] - P[j][i]), [, by] = F.backprop.fromField(st, 0, 1 - ((j + a) / NY) * 2); dot(x, by, 1.2, 0.9, C.ink); }
            }
            // the data: filled for one class, rings for the other
            st.data.forEach(([u, v, c]) => { const [x, y] = F.backprop.fromField(st, u, v); if (c) dot(x, y, 2.6, 1, C.ink); else { ctx.globalAlpha = 1; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.stroke(); } });
            // the network: nodes in columns, connections as dotted lines weighted by size
            const S = F.backprop.SIZES, nb = st.netbox, acts = st.probe ? F.backprop.forward(st, st.probe) : null;
            const pos = (l, j) => [nb.x0 + (l / (S.length - 1)) * (nb.x1 - nb.x0), nb.y0 + ((j + 0.5) / S[l]) * (nb.y1 - nb.y0)];
            let wmax = 0; st.net.forEach((L) => L.W.forEach((row) => row.forEach((w) => (wmax = Math.max(wmax, Math.abs(w))))));
            st.net.forEach((L, l) => L.W.forEach((row, j) => row.forEach((w, i) => {
                const [x0, y0] = pos(l, i), [x1, y1] = pos(l + 1, j), on = st.mask[l][j][i], m = Math.abs(w) / (wmax || 1), n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / (on ? 4 : 9)));
                for (let k = 1; k < n; k++) dot(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, on ? 0.35 + 0.8 * m : 0.3, on ? 0.12 + 0.6 * m : 0.12, on ? (w > 0 ? C.ink : C.ink3) : C.ink3);   // pruned: faint ghosts
            })));
            S.forEach((n, l) => { for (let j = 0; j < n; j++) { const [x, y] = pos(l, j), a = acts ? Math.abs(acts[l][j]) : 0.5; dot(x, y, 3.2, 1, C.bg || '#fff'); ctx.globalAlpha = 0.9; ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.stroke(); dot(x, y, 2.6 * a, acts ? 1 : 0.5, C.ink); } });
            if (st.probe) { const [x, y] = F.backprop.fromField(st, st.probe[0], st.probe[1]); ctx.globalAlpha = 0.9; ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.stroke(); }
            label(ctx, C, st, st.pruned ? `ticket: ${Math.round(F.backprop.left(st) * 100)}% of weights` : 'network 2 → 6 → 6 → 1', nb.x0 - 2, st.vy0 - 2, 'left', !!st.pruned);
            label(ctx, C, st, 'click: prune + rewind', nb.x0 - 2, st.vy1 + 6);
            label(ctx, C, st, 'decision boundary', f.x0 + 4, st.vy0 - 2, 'left', true);
            label(ctx, C, st, live && st.train > 0 ? (st.pruned ? 'retraining the ticket from its initial weights' : 'training: backprop + gradient descent') : 'click: add a point it gets wrong', f.x1, st.vy1 + 6, 'right');
            if (!still && st.train > 0) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // The logit lens (nostalgebraist; refined as the tuned lens by Belrose et al.): decode the residual
    // stream at every layer through the unembedding and read what the model would predict at that depth.
    // Rows are layers (bottom to top), columns are positions in the prompt; each cell is a halftone of the
    // top prediction's probability, darkest when it is already the final answer. Pointing at a position
    // sends a lens up the layers, decoding as it goes; at the right, the final answer's probability climbs
    // with depth. Hovering shows the decoded words. Values are illustrative.
    F.lens = {
        bleed: true, LAYERS: 12,
        title: 'Logit lens', note: 'Every layer decoded through the unembedding: predictions sharpen from generic tokens to the answer. Illustrative values.',
        PROMPT: [
            { tok: 'The', ans: 'first', mid: 'same', c: 7.5 },
            { tok: 'capital', ans: 'of', mid: 'city', c: 5.5 },
            { tok: 'of', ans: 'France', mid: 'the', c: 8.5 },
            { tok: 'France', ans: 'is', mid: 'Paris', c: 7 },
            { tok: 'is', ans: 'Paris', mid: 'French', c: 8 },
        ],
        init(R) {
            const fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = R.vy1 ?? R.y + R.h, W = R.x + R.w - fx;
            const grid = { x0: fx + 40, x1: fx + W * 0.68, y0: vy0 + 4, y1: vy1 - 14 };
            const curve = { x0: fx + W * 0.74, x1: fx + W - 8 };
            // each cell: the top decoded token and its probability; generic early, a related concept midway, the answer late
            const cells = F.lens.PROMPT.map((p) => Array.from({ length: F.lens.LAYERS }, (_, l) => {
                const pa = 1 / (1 + Math.exp(-(l - p.c) * 1.1)), pm = 0.55 * Math.exp(-((l - (p.c - 2.5)) ** 2) / 4), pg = 0.22 * Math.exp(-l / 3);
                const best = Math.max(pa, pm, pg);
                return best === pa ? { w: p.ans, p: pa, kind: 2, pa } : best === pm ? { w: p.mid, p: pm, kind: 1, pa } : { w: ['the', ',', 'a', 'and'][l % 4], p: pg, kind: 0, pa };
            }));
            return { fx, vy0, vy1, W, grid, curve, cells, pos: F.lens.PROMPT.length - 1, since: -1 };
        },
        pointer(type, x, y, st) {
            if (type !== 'move' && type !== 'down' && type !== 'key') return;
            const g = st.grid, n = F.lens.PROMPT.length;
            let pos = type === 'key' ? st.pos + (x[0] || x[1]) : Math.floor(((x - g.x0) / (g.x1 - g.x0)) * n);
            if (type !== 'key' && (x < g.x0 - 10 || x > g.x1 + 10)) return;
            pos = Math.max(0, Math.min(n - 1, pos));
            if (pos !== st.pos || type === 'down') { st.pos = pos; st.since = null; st.wake = 2.2; }
        },
        draw(ctx, R, t, C, st, still) {
            if (st.since === null) st.since = t;
            const e = still || st.since < 0 ? 1 : Math.min(1, (t - st.since) / 1.8), L = F.lens.LAYERS, n = F.lens.PROMPT.length, g = st.grid;
            const cw = (g.x1 - g.x0) / n, rh = (g.y1 - g.y0) / L, sweep = e * L;                   // the lens's height, in layers
            const rowY = (l) => g.y1 - (l + 0.5) * rh;
            // halftone: an ordered 4×4 threshold pattern, so a cell's darkness reads as its probability
            const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            for (let c = 0; c < n; c++) for (let l = 0; l < L; l++) {
                const cell = st.cells[c][l], sel = c === st.pos, x0 = g.x0 + c * cw + 3, y0 = g.y1 - (l + 1) * rh + 2, wv = cw - 6, hv = rh - 4;
                const decoded = !sel || l < sweep, p = decoded ? cell.p : 0, col = cell.kind === 2 ? C.ink : cell.kind === 1 ? C.ink2 : C.ink3;
                const step = 3, nx = Math.floor(wv / step), ny = Math.max(1, Math.floor(hv / step));
                for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
                    const th = BAYER[(j % 4) * 4 + (i % 4)], on = th < p;
                    if (on) dot(x0 + i * step + 1.5, y0 + j * step + 1.5, 0.8, sel ? 0.95 : 0.6, col);
                    else if ((i + j) % 3 === 0) dot(x0 + i * step + 1.5, y0 + j * step + 1.5, 0.45, 0.15, C.ink3);
                }
            }
            // the lens: a dotted lozenge riding up the selected column
            if (e < 1 || st.hover) {
                const cx = g.x0 + (st.pos + 0.5) * cw, cy = g.y1 - Math.min(L, sweep) * rh, rx = cw * 0.62, ry = rh * 0.9;
                for (let k = 0; k < 40; k++) { const a = (k / 40) * TAU; dot(cx + rx * Math.cos(a), cy + ry * Math.sin(a), 0.7, 0.8, C.ink); }
            }
            // the selected column's bracket and the input tokens below
            for (let k = 0; k < 4; k++) dot(g.x0 + st.pos * cw + 2 + k * ((cw - 4) / 3), g.y1 + 4, 1, 0.9, C.ink);
            // right: the final answer's probability at each layer, rising with depth
            const cv = st.curve;
            ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.5; for (let l = 0; l < L; l++) ctx.fillRect(cv.x0 - 0.5, rowY(l) - 0.5, 1, 1);
            for (let l = 0; l < L; l++) {
                if (l >= sweep) break;
                const pa = st.cells[st.pos][l].pa, x = cv.x0 + pa * (cv.x1 - cv.x0), y = rowY(l);
                const m = Math.max(1, Math.round((x - cv.x0) / 3)); for (let k = 0; k <= m; k++) dot(cv.x0 + (k / m) * (x - cv.x0), y, 0.55, 0.35, C.ink3);
                dot(x, y, 1.8, 1, C.ink);
            }
            // hover: the words
            const P = F.lens.PROMPT[st.pos];
            F.lens.PROMPT.forEach((p, c) => label(ctx, C, st, p.tok, g.x0 + (c + 0.5) * cw, g.y1 + 12, 'center', c === st.pos));
            if (st.hover) for (let l = 0; l < L; l += 1) { if (l >= sweep) break; const cell = st.cells[st.pos][l]; if (l % 2 === 1 || l === L - 1) label(ctx, C, st, cell.w, g.x0 + (st.pos + 0.5) * cw, rowY(l), 'center', cell.kind === 2); }
            label(ctx, C, st, 'layer', g.x0 - 8, g.y0 - 8, 'right');
            label(ctx, C, st, '1', g.x0 - 8, rowY(0), 'right'); label(ctx, C, st, String(L), g.x0 - 8, rowY(L - 1), 'right');
            label(ctx, C, st, `p("${P.ans}")`, cv.x0, g.y0 - 2, 'left', true);
            label(ctx, C, st, 'illustrative', cv.x1, g.y1 + 12, 'right');
            if (!still && e < 1) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // RL fine-tunes small subnetworks (Mukherjee et al.): RL post-training moves only a small subset of an
    // LLM's weights (5–30% in the paper), similarly sparse in nearly every matrix, and the subsets from
    // different seeds overlap far more than chance. Three weight matrices per row as dot grids. Top: SFT,
    // where nearly every weight moves. Bottom: RL, where a sparse subnetwork moves. Drag to scrub training;
    // a click runs another RL seed, and its subnetwork lands mostly on the last one: solid where both moved,
    // lighter where only the new run did, faint rings where only the old one did. Values are illustrative.
    F.rlsparse = {
        bleed: true, NX: 30, NY: 14, FRAC: 0.18,
        title: 'RL fine-tunes small subnetworks', note: 'SFT moves nearly every weight; RL moves a sparse subnetwork that recurs across seeds. Illustrative.',
        init(R, rand) {
            const r = rand(53), fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = (R.vy1 ?? R.y + R.h) + 4, W = R.x + R.w - fx;
            const { NX, NY } = F.rlsparse, n = NX * NY, gap = 14, mw = (W - 8 - 2 * gap) / 3, rowH = (vy1 - vy0 - 18) / 2;
            // each matrix: a smooth "importance" field (where RL tends to act) plus the SFT update size per weight
            const mats = [0, 1, 2].map(() => {
                const waves = Array.from({ length: 4 }, () => [r() * 6, r() * 6, r() * TAU, r() * TAU]);
                const imp = Array.from({ length: n }, (_, k) => { const x = (k % NX) / NX, y = Math.floor(k / NX) / NY; return waves.reduce((a, [fa, fb, pa, pb]) => a + Math.sin(fa * x * TAU + pa) * Math.sin(fb * y * TAU + pb), 0) + (r() - 0.5) * 1.2; });
                const sft = Array.from({ length: n }, () => 0.4 + r() * 0.6);
                return { imp, sft };
            });
            const st = { r, fx, vy0, vy1, W, mats, mw, gap, rowH, u: 1, seed: 0, mask: null, prev: null, anim: null };
            st.mask = F.rlsparse.subnet(st); st.prev = null;
            return st;
        },
        // the RL subnetwork for a new seed: the most important weights, with seed noise, so seeds overlap well above chance
        subnet(st) {
            const { NX, NY, FRAC } = F.rlsparse, n = NX * NY, r = st.r;
            return st.mats.map((m) => { const score = m.imp.map((v) => v + (r() - 0.5) * 2.2), cut = score.slice().sort((a, b) => b - a)[Math.floor(n * FRAC)]; return score.map((v) => (v > cut ? 1 : 0)); });
        },
        overlap(st) { if (!st.prev) return null; let both = 0, a = 0; st.mask.forEach((M, i) => M.forEach((v, k) => { if (v) { a++; if (st.prev[i][k]) both++; } })); return both / a; },
        pointer(type, x, y, st) {
            if (type === 'down') st.press = { x, moved: false };
            else if (type === 'move' && st.press) { if (Math.abs(x - st.press.x) > 4) st.press.moved = true; if (st.press.moved) { st.anim = null; st.u = Math.max(0, Math.min(1, (x - st.fx) / (st.W - 10))); st.wake = 0.5; } }
            else if (type === 'up' && st.press) {
                if (!st.press.moved) { st.prev = st.mask; st.mask = F.rlsparse.subnet(st); st.seed++; st.anim = { start: null }; st.wake = 3.4; }
                st.press = null;
            }
        },
        draw(ctx, R, t, C, st, still) {
            if (st.anim && !still) { if (st.anim.start == null) st.anim.start = t; const e = (t - st.anim.start) / 3; st.u = smooth(Math.min(1, e)); if (e >= 1) st.anim = null; }
            const { NX, NY } = F.rlsparse, { mw, gap, rowH } = st, u = st.u, sx = mw / NX, sy = rowH / NY;
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            for (let row = 0; row < 2; row++) for (let mi = 0; mi < 3; mi++) {
                const m = st.mats[mi], x0 = st.fx + 4 + mi * (mw + gap), y0 = st.vy0 + 10 + row * (rowH + 18);
                for (let k = 0; k < NX * NY; k++) {
                    const x = x0 + ((k % NX) + 0.5) * sx, y = y0 + (Math.floor(k / NX) + 0.5) * sy;
                    if (row === 0) {                                                             // SFT: every weight moves
                        const a = u * m.sft[k]; dot(x, y, 0.45 + 0.85 * a, 0.18 + 0.6 * a, a > 0.5 ? C.ink : C.ink2);
                    } else {                                                                     // RL: only the subnetwork moves
                        const on = st.mask[mi][k], was = st.prev && st.prev[mi][k];
                        if (on) dot(x, y, 0.45 + 1.0 * u, 0.2 + 0.75 * u, was || !st.prev ? C.ink : C.ink2);
                        else if (was && st.anim) { ctx.globalAlpha = 0.5 * (1 - u); ctx.strokeStyle = C.ink2; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.stroke(); }
                        else dot(x, y, 0.45, 0.16, C.ink3);
                    }
                }
            }
            // training progress: a dotted axis along the bottom
            const ay = st.vy1 + 8; ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.6; for (let x = st.fx + 4; x <= st.fx + st.W - 6; x += 4) ctx.fillRect(x - 0.5, ay - 0.5, 1, 1);
            ctx.globalAlpha = 1; ctx.fillStyle = C.ink; ctx.fillRect(st.fx + 4 + u * (st.W - 10) - 1, ay - 4, 2, 8);
            label(ctx, C, st, 'SFT: nearly every weight moves', st.fx + 4, st.vy0 + 2, 'left', true);
            label(ctx, C, st, `RL: ~${Math.round(F.rlsparse.FRAC * 100)}% of weights move`, st.fx + 4, st.vy0 + 10 + rowH + 10, 'left', true);
            const ov = F.rlsparse.overlap(st);
            label(ctx, C, st, ov != null ? `seed ${st.seed + 1}: ${Math.round(ov * 100)}% overlap with the last (chance: ${Math.round(F.rlsparse.FRAC * 100)}%)` : 'click: another RL seed', st.fx + st.W - 6, st.vy0 + 10 + rowH + 10, 'right');
            label(ctx, C, st, 'training', st.fx + 4, ay + 10);
            label(ctx, C, st, 'illustrative', st.fx + st.W - 6, ay + 10, 'right');
            if (!still && (st.anim || st.press)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // The logit lens, drawn in the plane: the vocabulary as directions (the unembedding), and the residual
    // stream as an arrow built tip to tail, each layer adding its update (attention + MLP). At any layer
    // the lens reads the stream by projecting it onto every token direction and taking a softmax; the bars
    // on the directions are that distribution, sliding from generic tokens to related ones to the answer.
    // Drag (or the arrow keys) to move through the layers; a click replays the sweep. Illustrative.
    F.lens2 = {
        bleed: true, L: 12,
        title: 'Logit lens', note: 'The residual stream grows layer by layer; projecting it onto token directions reads off the prediction at each depth.',
        TOKENS: [['Paris', 72], ['city', 112], ['France', 32], ['London', 150], ['French', 0], ['the', 205], [',', 245], ['capital', 290], ['is', 330]],
        // the stream's tip per layer (angle in degrees, length): generic early, related midway, the answer late
        PATH: [[220, 0.18], [230, 0.3], [238, 0.38], [215, 0.42], [190, 0.4], [150, 0.42], [100, 0.46], [40, 0.55], [20, 0.62], [45, 0.72], [62, 0.84], [70, 0.94], [72, 1.02]],
        init(R) {
            const fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = (R.vy1 ?? R.y + R.h) - 10, W = R.x + R.w - fx;
            const rad = Math.min((vy1 - vy0) * 0.33, W * 0.24);
            return { fx, vy0, vy1, W, cx: fx + W * 0.5, cy: (vy0 + vy1) / 2 + 6, rad, u: F.lens2.L, anim: null, axis: { x0: fx + W * 0.2, x1: fx + W * 0.8, y: vy1 + 12 } };
        },
        tip(st, u) {                                                                           // the stream at fractional layer u, as (x, y) in units
            const P = F.lens2.PATH, k = Math.min(P.length - 2, Math.floor(u)), f = u - k, at = ([a, m]) => [m * Math.cos((a * Math.PI) / 180), m * Math.sin((a * Math.PI) / 180)];
            const a = at(P[k]), b = at(P[k + 1]); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        },
        probs(st, h) { const z = F.lens2.TOKENS.map(([, a]) => 5 * (h[0] * Math.cos((a * Math.PI) / 180) + h[1] * Math.sin((a * Math.PI) / 180))), m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s2 = e.reduce((p, q) => p + q, 0); return e.map((v) => v / s2); },
        // drag the stream's tip to set the hidden state by hand; drag elsewhere to move through the layers; a click replays
        pointer(type, x, y, st) {
            const A = st.axis, uAt = (px) => Math.max(0, Math.min(F.lens2.L, ((px - A.x0) / (A.x1 - A.x0)) * F.lens2.L));
            const toU = (px, py) => { const vx = (px - st.cx) / st.rad, vy = -(py - st.cy) / st.rad, m = Math.hypot(vx, vy), k = m > 1.05 ? 1.05 / m : 1; return [vx * k, vy * k]; };
            if (type === 'key') { st.anim = null; st.custom = null; st.u = Math.max(0, Math.min(F.lens2.L, Math.round(st.u) + (x[0] || -x[1]))); st.wake = 0.6; return; }
            if (type === 'move' && !st.press) { const h = st.custom || F.lens2.tip(st, st.u), d = Math.hypot(x - (st.cx + h[0] * st.rad), y - (st.cy - h[1] * st.rad)); st.overTip = d < 14; }
            if (type === 'down') { const h = st.custom || F.lens2.tip(st, st.u), d = Math.hypot(x - (st.cx + h[0] * st.rad), y - (st.cy - h[1] * st.rad)); st.press = { x, moved: false, tip: d < 14 }; }
            else if (type === 'move' && st.press) {
                if (Math.abs(x - st.press.x) > 3) st.press.moved = true;
                if (st.press.tip) { st.anim = null; st.custom = toU(x, y); st.wake = 0.5; }
                else if (st.press.moved) { st.anim = null; st.custom = null; st.u = uAt(x); st.wake = 0.5; }
            } else if (type === 'up' && st.press) { if (!st.press.moved && !st.press.tip) { st.custom = null; st.anim = { start: null }; st.wake = 4; } st.press = null; }
        },
        draw(ctx, R, t, C, st, still) {
            if (st.anim && !still) { if (st.anim.start == null) st.anim.start = t; const e = (t - st.anim.start) / 3.5; st.u = F.lens2.L * Math.min(1, Math.max(0, e)); if (e >= 1) st.anim = null; }
            const { cx, cy, rad } = st, u = st.u, L = F.lens2.L, T = F.lens2.TOKENS;
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            const P = ([x, y]) => [cx + x * rad, cy - y * rad];
            const line = (a, b, step, size, alpha, col) => { const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let i = 0; i <= n; i++) dot(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, size, alpha, col); };
            const h = st.custom || F.lens2.tip(st, u), p = F.lens2.probs(st, h), top = p.indexOf(Math.max(...p)), rank = p.map((v, i) => [v, i]).sort((a2, b2) => b2[0] - a2[0]).slice(0, 4).map((e2) => e2[1]);
            // the vocabulary: a direction per token, and the lens's distribution as a bar along it
            T.forEach(([w, a], i) => {
                const ux = Math.cos((a * Math.PI) / 180), uy = Math.sin((a * Math.PI) / 180), end = P([ux, uy]);
                line(P([0, 0]), end, 6, 0.45, 0.18, C.ink3);
                dot(...end, 0.9, 0.45, C.ink3);
                const len = 0.08 + p[i] * 1.5, b0 = P([ux * 1.06, uy * 1.06]), b1 = P([ux * (1.06 + len * 0.55), uy * (1.06 + len * 0.55)]);
                line(b0, b1, 1.9, i === top ? 1.5 : 1, i === top ? 1 : 0.35 + 0.5 * Math.sqrt(p[i]), i === top ? C.ink : C.ink2);
                if (rank.includes(i)) label(ctx, C, st, `${w} ${Math.round(p[i] * 100)}%`, ...P([ux * (1.16 + len * 0.55), uy * (1.16 + len * 0.55)]), ux > 0.2 ? 'left' : ux < -0.2 ? 'right' : 'center', i === top);
            });
            // the residual stream: layer updates tip to tail, up to the current layer
            let prev = F.lens2.tip(st, 0);
            dot(...P(prev), 1.6, st.custom ? 0.3 : 0.8, C.ink2);
            for (let l = 1; l <= (st.custom ? 0 : Math.ceil(u)); l++) {
                const cur = F.lens2.tip(st, Math.min(u, l));
                line(P(prev), P(cur), 2.6, 0.8, 0.85, C.ink2); dot(...P(cur), l <= u ? 1.4 : 0, 0.8, C.ink2); prev = cur;
            }
            // and the stream as one arrow from the origin: what the lens reads
            line(P([0, 0]), P(h), 3, 0.9, 0.9, C.ink); dot(...P(h), st.overTip || (st.press && st.press.tip) ? 4.2 : 3, 1, C.ink);
            if (st.overTip || (st.press && st.press.tip)) { ctx.globalAlpha = 0.6; ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(...P(h), 8, 0, TAU); ctx.stroke(); }
            // layers: an axis with a tick per layer and a handle
            const A = st.axis; ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.6;
            for (let l = 0; l <= L; l++) ctx.fillRect(A.x0 + (l / L) * (A.x1 - A.x0) - 0.5, A.y - (l % 4 ? 2 : 3.5), 1, l % 4 ? 4 : 7);
            for (let x = A.x0; x <= A.x1; x += 4) ctx.fillRect(x - 0.5, A.y - 0.5, 1, 1);
            ctx.globalAlpha = 1; ctx.fillStyle = C.ink; ctx.fillRect(A.x0 + (u / L) * (A.x1 - A.x0) - 1, A.y - 5, 2, 10);
            label(ctx, C, st, st.custom ? 'custom' : `layer ${Math.round(u)} of ${L}`, A.x0 - 8, A.y, 'right', true);
            label(ctx, C, st, 'lens: softmax(h · W_U)', st.fx + 4, st.vy0 - 2);
            label(ctx, C, st, st.custom ? 'your hidden state: drag it' : 'residual stream h (drag its tip)', ...P([h[0] * 0.5, h[1] * 0.5 - 0.14]), 'center');
            label(ctx, C, st, 'illustrative', A.x1 + 8, A.y, 'left');
            if (!still && (st.anim || st.press)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // RL sharpens, it does not widen (Yue et al.): RL with verifiable rewards raises pass@1 but narrows what
    // the model can reach. Left: the tree of reasoning paths a model samples for one problem; leaves are
    // right (filled) or wrong (rings), path weight is probability. Dragging trains with RL: mass flows to
    // the correct paths the base model already liked, and rare paths, correct ones included, fade away.
    // Right: pass@k over a set of problems for the base model and the trained one; they cross, with the
    // base model ahead at large k. A click shows another problem. Illustrative.
    F.passk = {
        bleed: true, P: 14, B: [3, 2, 2],
        title: 'RL sharpens, not widens', note: 'RLVR concentrates mass on paths the base model already found: pass@1 rises, pass@k at large k falls. Illustrative.',
        init(R, rand) {
            const r = rand(59), fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = (R.vy1 ?? R.y + R.h) - 4, W = R.x + R.w - fx;
            const nL = F.passk.B.reduce((a, b) => a * b, 1);
            // problems: leaf probabilities (a product of branch choices) and which leaves are right; some problems
            // are solved only by a rare path
            const problems = Array.from({ length: F.passk.P }, (_, j) => {
                const edge = () => { const w = F.passk.B.map((n) => Array.from({ length: n }, () => r() ** 1.6 + 0.05)); return w; };
                const p = []; let k = 0;
                const walk = (lvl, mass) => { if (lvl === F.passk.B.length) { p.push(mass); return; } const w = Array.from({ length: F.passk.B[lvl] }, () => r() ** 1.6 + 0.04), s2 = w.reduce((a, b) => a + b, 0); w.forEach((v) => walk(lvl + 1, (mass * v) / s2)); };
                walk(0, 1);
                const order = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
                const right = p.map(() => 0);
                if (j % 3 === 2) right[order[nL - 1 - Math.floor(r() * 3)][1]] = 1;                   // hard: only a rare path is right
                else { const m = 1 + Math.floor(r() * 3); for (let q = 0; q < m; q++) right[order[Math.floor(r() * 6)][1]] = 1; }
                return { p, right };
            });
            const st = { fx, vy0, vy1, W, problems, j: 0, u: 0, tree: { x0: fx + 10, x1: fx + W * 0.5, y0: vy0 + 6, y1: vy1 - 6 }, chart: { x0: fx + W * 0.6, x1: fx + W - 8, y0: vy0 + 8, y1: vy1 - 12 } };
            return st;
        },
        // the policy after training u ∈ [0,1]: sharpened (rare paths fade) and tilted towards reward
        policy(pr, u) { const w = pr.p.map((v, i) => v ** (1 + 3 * u) * Math.exp(2.2 * u * pr.right[i])), s2 = w.reduce((a, b) => a + b, 0); return w.map((v) => v / s2); },
        passk(st, u, k) { return st.problems.reduce((a, pr) => { const pc = F.passk.policy(pr, u).reduce((s2, v, i) => s2 + v * pr.right[i], 0); return a + 1 - (1 - pc) ** k; }, 0) / st.problems.length; },
        pointer(type, x, y, st) {
            if (type === 'down') st.press = { x, moved: false };
            else if (type === 'move' && st.press) { if (Math.abs(x - st.press.x) > 3) st.press.moved = true; if (st.press.moved) { st.u = Math.max(0, Math.min(1, (x - st.fx) / (st.W - 10))); st.wake = 0.5; } }
            else if (type === 'up' && st.press) { if (!st.press.moved) { st.j = (st.j + 1) % st.problems.length; st.since = null; st.wake = 1; } st.press = null; }
        },
        draw(ctx, R, t, C, st, still) {
            if (st.since === null) st.since = t;
            const pr = st.problems[st.j], pol = F.passk.policy(pr, st.u), B = F.passk.B, tr = st.tree;
            const fade = still || st.since == null || st.since < 0 ? 1 : smooth((t - st.since) / 0.6);
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            // the tree: root at left, leaves at right; each edge weighted by the probability mass beneath it
            const nL = pol.length, leafY = (i) => tr.y0 + ((i + 0.5) / nL) * (tr.y1 - tr.y0), depthX = (d) => tr.x0 + (d / B.length) * (tr.x1 - tr.x0);
            const build = (lvl, lo, hi) => { const node = { lvl, lo, hi, y: (leafY(lo) + leafY(hi - 1)) / 2, mass: pol.slice(lo, hi).reduce((a, b) => a + b, 0), kids: [] }; if (lvl < B.length) { const span = (hi - lo) / B[lvl]; for (let c = 0; c < B[lvl]; c++) node.kids.push(build(lvl + 1, lo + c * span, lo + (c + 1) * span)); } return node; };
            const root = build(0, 0, nL);
            const edges = (n) => n.kids.forEach((k) => { const x0 = depthX(n.lvl), x1 = depthX(k.lvl), m = Math.max(4, Math.round((x1 - x0) / 3.2)); for (let i = 1; i < m; i++) { const f = i / m, e = f * f * (3 - 2 * f); dot(x0 + (x1 - x0) * f, n.y + (k.y - n.y) * e, 0.35 + 1.4 * Math.sqrt(k.mass), fade * (0.15 + 0.85 * Math.sqrt(k.mass)), C.ink2); } edges(k); });
            edges(root); dot(depthX(0), root.y, 2.4, 1, C.ink);
            pol.forEach((v, i) => { const x = depthX(B.length) + 6, y = leafY(i), s2 = 1.2 + 4 * Math.sqrt(v); if (pr.right[i]) dot(x, y, s2, fade, C.ink); else { ctx.globalAlpha = fade * (0.4 + 0.6 * Math.sqrt(v)); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, s2, 0, TAU); ctx.stroke(); } });
            // pass@k: base (dotted) and trained (solid), k on a log scale
            const ch = st.chart, K = [1, 2, 4, 8, 16, 32, 64, 128, 256], X = (k) => ch.x0 + (Math.log2(k) / 8) * (ch.x1 - ch.x0), Y = (v) => ch.y1 - v * (ch.y1 - ch.y0);
            ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.5; for (let x = ch.x0; x <= ch.x1; x += 4) ctx.fillRect(x - 0.5, ch.y1 - 0.5, 1, 1); for (let y = ch.y0; y <= ch.y1; y += 4) ctx.fillRect(ch.x0 - 0.5, y - 0.5, 1, 1);
            for (let s2 = 0; s2 <= 64; s2++) { const k = 2 ** (s2 / 8); dot(X(k), Y(F.passk.passk(st, 0, k)), 0.8, 0.6, C.ink3); dot(X(k), Y(F.passk.passk(st, st.u, k)), 1.1, st.u > 0.02 ? 0.95 : 0, C.ink); }
            K.forEach((k) => ctx.fillRect(X(k) - 0.5, ch.y1, 1, 3));
            // training: an axis along the bottom
            const ay = st.vy1 + 10; ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.6; for (let x = st.fx + 4; x <= st.fx + st.W - 6; x += 4) ctx.fillRect(x - 0.5, ay - 0.5, 1, 1);
            ctx.globalAlpha = 1; ctx.fillStyle = C.ink; ctx.fillRect(st.fx + 4 + st.u * (st.W - 10) - 1, ay - 4, 2, 8);
            label(ctx, C, st, st.u < 0.05 ? 'base model: sampled reasoning paths' : 'after RL: mass on paths it already liked', tr.x0, st.vy0 - 2, 'left', true);
            label(ctx, C, st, 'pass@k', ch.x0, ch.y0 - 6, 'left', true);
            label(ctx, C, st, 'k = 1', X(1), ch.y1 + 10, 'left'); label(ctx, C, st, '256', X(256), ch.y1 + 10, 'right');
            if (st.u > 0.3) label(ctx, C, st, 'base wins at large k', X(64), Y(F.passk.passk(st, 0, 64)) - 10, 'center');
            label(ctx, C, st, 'drag: RL training', st.fx + 4, ay + 10); label(ctx, C, st, 'illustrative', st.fx + st.W - 6, ay + 10, 'right');
            if (!still && (st.press || fade < 1)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // Diffusion (Ho et al.; Welch Labs' film of it for 3Blue1Brown): the forward process adds noise until
    // a spiral of data is a Gaussian cloud, x_t = √ᾱ_t x₀ + √(1 − ᾱ_t) ε; the reverse process starts from
    // noise and follows the score ∇ log p_t back to the data, with fresh noise at every step. Drag to scrub
    // the noise level; a click samples new points by running the reverse process. The score field is drawn
    // at the current t. The score is exact here: the data is a fixed set of points, slightly smoothed.
    F.diffusion = {
        bleed: true, N: 520, S: 60,
        title: 'Diffusion', note: 'Noise a distribution into a Gaussian, then follow the score back; draw any distribution to learn.',
        init(R, rand) {
            const r = rand(61), fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = (R.vy1 ?? R.y + R.h) - 6, W = R.x + R.w - fx;
            const g = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
            const data = Array.from({ length: F.diffusion.N }, (_, i) => { const s2 = Math.sqrt(r()) * 3.2 + 0.6, a = s2 * 1.9; return [Math.cos(a) * s2 * 0.32 + g() * 0.035, Math.sin(a) * s2 * 0.32 + g() * 0.035]; });
            const eps = data.map(() => [g(), g()]);
            const st = { r, g, fx, vy0, vy1, W, data, eps, t: 0.02, mode: 'forward', unit: Math.min((vy1 - vy0) / 5.2, W / 6.5), cx: fx + W * 0.5, cy: (vy0 + vy1) / 2, axis: { x0: fx + W * 0.18, x1: fx + W * 0.82, y: vy1 + 12 } };
            st.refs = data.filter((_, i) => i % 3 === 0); st.preset = 0;
            return st;
        },
        // preset distributions, in the figure's units; a click cycles them
        PRESETS: [
            (r, g, i, N) => { const s2 = Math.sqrt(r()) * 3.2 + 0.6, a = s2 * 1.9; return [Math.cos(a) * s2 * 0.32, Math.sin(a) * s2 * 0.32]; },                                   // spiral
            (r, g, i, N) => { const a = r() * Math.PI, up = i % 2; return up ? [Math.cos(a) * 0.9 - 0.45, Math.sin(a) * 0.9 - 0.25] : [Math.cos(a) * 0.9 + 0.45, -Math.sin(a) * 0.9 + 0.25]; },   // two moons
            (r, g, i, N) => { const a = r() * TAU, rr = i % 3 ? 1.05 : 0.45; return [Math.cos(a) * rr * 1.25, Math.sin(a) * rr]; },                                              // rings
            (r, g, i, N) => { const k = i % 10; if (k < 5) { const a = r() * TAU; return [Math.cos(a) * 1.35, Math.sin(a) * 1.05]; } if (k === 5) return [-0.45 + g() * 0.06, 0.35 + g() * 0.06]; if (k === 6) return [0.45 + g() * 0.06, 0.35 + g() * 0.06]; const a = Math.PI * (1.15 + 0.7 * r()); return [Math.cos(a) * 0.75, Math.sin(a) * 0.62 + 0.05]; },   // a smile
        ],
        setPreset(st, k) { const N = F.diffusion.N; st.preset = k; st.data = Array.from({ length: N }, (_, i) => { const [x, y] = F.diffusion.PRESETS[k](st.r, st.g, i, N); return [x + st.g() * 0.03, y + st.g() * 0.03]; }); st.refs = st.data.filter((_, i) => i % 3 === 0); st.fk = null; },
        abar(t) { const c = Math.cos((Math.PI / 2) * t); return Math.max(1e-4, c * c); },
        score(st, x, y, t) {
            const ab = F.diffusion.abar(t), sa = Math.sqrt(ab), v = 1 - ab + ab * 0.003;
            let mx = -Infinity; const l = st.refs.map(([a, b]) => { const d = -((x - sa * a) ** 2 + (y - sa * b) ** 2) / (2 * v); if (d > mx) mx = d; return d; });
            let ws = 0, sx = 0, sy = 0; st.refs.forEach(([a, b], j) => { const w = Math.exp(l[j] - mx); ws += w; sx += w * (sa * a - x); sy += w * (sa * b - y); });
            return [sx / ws / v, sy / ws / v];
        },
        // reverse diffusion with DDIM steps (Song et al.): from the score, estimate the clean point x̂₀ and the
        // noise ε̂, then step to the next noise level along them; a little fresh noise (η) keeps it a diffusion
        sample(st) {
            const S = F.diffusion.S, n = 300, out = new Float32Array(n * (S + 1) * 2), t0 = 0.98, eta = 0.12;
            const tAt = (k) => t0 * (1 - k / S) ** 1.4;                                            // finer steps near the data
            for (let i = 0; i < n; i++) {
                let x = st.g(), y = st.g(); out[i * (S + 1) * 2] = x; out[i * (S + 1) * 2 + 1] = y;
                for (let k = 0; k < S; k++) {
                    const t = tAt(k), tn = tAt(k + 1), ab = F.diffusion.abar(t), abn = k === S - 1 ? 1 : F.diffusion.abar(tn), [sx, sy] = F.diffusion.score(st, x, y, t);
                    const x0 = (x + (1 - ab) * sx) / Math.sqrt(ab), y0 = (y + (1 - ab) * sy) / Math.sqrt(ab);
                    const ex = -Math.sqrt(1 - ab) * sx, ey = -Math.sqrt(1 - ab) * sy;
                    const sig = k === S - 1 ? 0 : eta * Math.sqrt(((1 - abn) / (1 - ab)) * (1 - ab / abn)), dirc = Math.sqrt(Math.max(0, 1 - abn - sig * sig));
                    x = Math.sqrt(abn) * x0 + dirc * ex + sig * st.g(); y = Math.sqrt(abn) * y0 + dirc * ey + sig * st.g();
                    out[(i * (S + 1) + k + 1) * 2] = x; out[(i * (S + 1) + k + 1) * 2 + 1] = y;
                }
            }
            return { out, n };
        },
        // a drawn stroke becomes the data: points spread along it by arc length, with a little width
        setData(st, stroke) {
            const cum = [0]; for (let i = 1; i < stroke.length; i++) cum.push(cum[i - 1] + Math.hypot(stroke[i][0] - stroke[i - 1][0], stroke[i][1] - stroke[i - 1][1]));
            const Lt = cum[cum.length - 1] || 1, N = F.diffusion.N;
            st.data = Array.from({ length: N }, (_, n) => {
                const d = ((n + 0.5) / N) * Lt; let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
                const f = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), x = stroke[i - 1][0] + (stroke[i][0] - stroke[i - 1][0]) * f, y = stroke[i - 1][1] + (stroke[i][1] - stroke[i - 1][1]) * f;
                return [(x - st.cx) / st.unit + st.g() * 0.035, -(y - st.cy) / st.unit + st.g() * 0.035];
            });
            st.refs = st.data.filter((_, i) => i % 3 === 0); st.fk = null;
        },
        pointer(type, x, y, st) {
            const A = st.axis, tAt = (px) => Math.max(0.02, Math.min(0.98, (px - A.x0) / (A.x1 - A.x0))), onAxis = Math.abs(y - A.y) < 14;
            if (type === 'move' && !st.press) st.near = [x, y];
            if (type === 'leave') st.near = null;
            if (type === 'down') st.press = { x, y, moved: false, axis: onAxis, stroke: onAxis ? null : [[x, y]] };
            else if (type === 'move' && st.press) {
                // a click may wobble a little; it becomes a drag past 10px, or 5px once held for a moment
                const dm = Math.hypot(x - st.press.x, y - st.press.y); if (dm > 10 || (dm > 5 && performance.now() - st.press.t > 250)) st.press.moved = true;
                if (st.press.moved && st.press.axis) { st.mode = 'forward'; st.anim = null; st.t = tAt(x); }
                else if (st.press.moved) { const s0 = st.press.stroke, [lx, ly] = s0[s0.length - 1]; if (Math.hypot(x - lx, y - ly) > 3) s0.push([x, y]); }
                st.wake = 0.5;
            } else if (type === 'up' && st.press) {
                const pr = st.press; st.press = null;
                if (pr.axis && pr.moved) return;
                if (pr.stroke && pr.moved && pr.stroke.length > 4) F.diffusion.setData(st, pr.stroke);      // new data, then denoise onto it
                else F.diffusion.setPreset(st, (st.preset + 1) % F.diffusion.PRESETS.length);             // a plain click: the next preset
                st.samples = F.diffusion.sample(st); st.mode = 'reverse'; st.anim = { start: null }; st.wake = 5.4;
            }
        },
        draw(ctx, R, t, C, st, still) {
            const S = F.diffusion.S;
            if (st.anim && !still) { if (st.anim.start == null) st.anim.start = t; const e = Math.min(1, (t - st.anim.start) / 5); st.t = 0.98 * (1 - smooth(e)); if (e >= 1) st.anim = null; }
            const T = st.t, P = (x, y) => [st.cx + x * st.unit, st.cy - y * st.unit];
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            // the score field at this noise level
            const key = T.toFixed(2);
            if (st.fk !== key) { st.fk = key; st.field = []; for (let gx = 0; gx < 15; gx++) for (let gy = 0; gy < 7; gy++) { const x = -3 + (gx / 14) * 6, y = -1.5 + (gy / 6) * 3; st.field.push([x, y, ...F.diffusion.score(st, x, y, Math.max(0.03, T))]); } }
            st.field.forEach(([x, y, sx, sy]) => { const m = Math.hypot(sx, sy) || 1, L2 = Math.min(12, 4 + m * 0.6), [px, py] = P(x, y); for (let k = 0; k <= 4; k++) dot(px + (sx / m) * L2 * (k / 4), py - (sy / m) * L2 * (k / 4), k === 4 ? 0.9 : 0.5, 0.2 + 0.1 * k, C.ink3); });
            // the points: forward noising of the data, or the reverse-process samples
            const ab = F.diffusion.abar(T), sa = Math.sqrt(ab), sn = Math.sqrt(1 - ab);
            if (st.mode === 'reverse' && st.samples) st.data.forEach(([x, y]) => { const [px, py] = P(x, y); dot(px, py, 0.9, 0.16, C.ink3); });   // the target, faintly
            if (st.mode === 'forward' || !st.samples) st.data.forEach(([x, y], i) => { const [px, py] = P(sa * x + sn * st.eps[i][0], sa * y + sn * st.eps[i][1]); dot(px, py, 1, 0.7, C.ink); });
            else {
                const { out, n } = st.samples, f = (1 - (T / 0.98) ** (1 / 1.4)) * S, k = Math.min(S - 1, Math.floor(f)), u = f - k;   // inverse of the sampler's step times
                for (let i = 0; i < n; i++) {
                    const o = (i * (S + 1) + k) * 2, x = out[o] + (out[o + 2] - out[o]) * u, y = out[o + 1] + (out[o + 3] - out[o + 1]) * u, [px, py] = P(x, y);
                    if (i % 12 === 0) for (let q = 0; q <= k; q += 2) { const [tx, ty] = P(out[(i * (S + 1) + q) * 2], out[(i * (S + 1) + q) * 2 + 1]); dot(tx, ty, 0.5, 0.25, C.ink3); }
                    dot(px, py, 1.1, 0.85, C.ink);
                }
            }
            if (st.press && st.press.stroke && st.press.moved) st.press.stroke.forEach(([x, y]) => dot(x, y, 1.4, 0.9, C.ink));   // the drawing in progress
            // hover: one point's whole path, from data to noise (forward) or from noise to data (reverse)
            if (st.near && !st.press) {
                const [hx0, hy0] = st.near; let path = null;
                if (st.mode === 'reverse' && st.samples) {
                    const { out, n } = st.samples, f = Math.round((1 - (T / 0.98) ** (1 / 1.4)) * S); let bi = -1, bd = 18;
                    for (let i = 0; i < n; i++) { const o = (i * (S + 1) + Math.min(S, f)) * 2, [px, py] = P(out[o], out[o + 1]), d = Math.hypot(px - hx0, py - hy0); if (d < bd) { bd = d; bi = i; } }
                    if (bi >= 0) path = Array.from({ length: S + 1 }, (_, k) => P(out[(bi * (S + 1) + k) * 2], out[(bi * (S + 1) + k) * 2 + 1]));
                } else {
                    const ab2 = (tt) => F.diffusion.abar(tt); let bi = -1, bd = 18;
                    st.data.forEach(([x, y], i) => { const a = ab2(T), [px, py] = P(Math.sqrt(a) * x + Math.sqrt(1 - a) * st.eps[i][0], Math.sqrt(a) * y + Math.sqrt(1 - a) * st.eps[i][1]); const d = Math.hypot(px - hx0, py - hy0); if (d < bd) { bd = d; bi = i; } });
                    if (bi >= 0) path = Array.from({ length: 41 }, (_, k) => { const a = ab2(k / 40 * 0.98), [x, y] = st.data[bi]; return P(Math.sqrt(a) * x + Math.sqrt(1 - a) * st.eps[bi][0], Math.sqrt(a) * y + Math.sqrt(1 - a) * st.eps[bi][1]); });
                }
                if (path) { path.forEach(([x, y], k) => dot(x, y, 0.9, 0.85, C.ink)); ctx.globalAlpha = 1; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(path[0][0], path[0][1], 3.5, 0, TAU); ctx.stroke(); dot(path[path.length - 1][0], path[path.length - 1][1], 2.6, 1, C.ink);
                    label(ctx, C, st, st.mode === 'reverse' ? 'one sample: noise → data' : 'one point: data → noise', path[path.length - 1][0] + 8, path[path.length - 1][1], 'left', true); }
            }
            // noise level: an axis with a handle
            const A = st.axis; ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.6; for (let x = A.x0; x <= A.x1; x += 4) ctx.fillRect(x - 0.5, A.y - 0.5, 1, 1);
            const hx = A.x0 + T * (A.x1 - A.x0); ctx.globalAlpha = 1; ctx.fillStyle = C.ink; ctx.fillRect(hx - 1, A.y - 5, 2, 10);
            label(ctx, C, st, 'data', A.x0 - 6, A.y, 'right'); label(ctx, C, st, 'noise', A.x1 + 6, A.y, 'left');
            label(ctx, C, st, `t ${T.toFixed(2)}`, hx, A.y - 12, 'center', true);
            label(ctx, C, st, st.mode === 'reverse' ? 'reverse process: denoising from noise' : 'forward process: adding noise', st.fx + 4, st.vy0 - 2, 'left', true);
            label(ctx, C, st, 'score ∇ log p_t · draw a distribution · click: next preset', st.fx + st.W - 6, st.vy0 - 2, 'right');
            if (!still && (st.anim || st.press)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // Grokking (Power et al.; the clock picture from Nanda et al.): a network learning a + b mod 23 fits its
    // training set early, while test accuracy stays at chance; long after, test accuracy jumps as the
    // numbers' embeddings arrange themselves on a circle, like a clock face, the structure that solves
    // modular addition. Left: the embeddings of 0 … 22 in their two main directions. Right: train and test
    // accuracy against training steps (log scale). Drag to scrub training; a click replays it. Illustrative.
    F.grokking = {
        bleed: true, P: 23, FREQ: 5,
        title: 'Grokking', note: 'Train accuracy saturates early; much later test accuracy jumps as the number embeddings form a circle. Illustrative.',
        init(R, rand) {
            const r = rand(67), fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = (R.vy1 ?? R.y + R.h) - 6, W = R.x + R.w - fx, p = F.grokking.P;
            const start = Array.from({ length: p }, () => [(r() - 0.5) * 1.6, (r() - 0.5) * 1.6]);
            const drift = Array.from({ length: p }, () => [r() * TAU, r() * TAU, 0.5 + r()]);
            const rad = Math.min((vy1 - vy0) * 0.42, W * 0.2);
            return { fx, vy0, vy1, W, start, drift, u: 1, wd: 0.6, anim: null, emb: { x: fx + rad + 14, y: (vy0 + vy1) / 2, rad }, chart: { x0: fx + W * 0.48, x1: fx + W - 8, y0: vy0 + 8, y1: vy1 - 8 } };
        },
        accTrain(u) { return 0.04 + 0.96 / (1 + Math.exp(-(u - 0.18) * 30)); },
        // weight decay sets when (and whether) the network groks: stronger decay, earlier; none, never in this run
        grokAt(wd) { return wd < 0.1 ? 9 : 0.98 - 0.42 * wd; },
        accTest(u, wd = 0.6) { return 0.04 + 0.95 / (1 + Math.exp(-(u - F.grokking.grokAt(wd)) * 26)); },
        // pointer height sets the weight decay (top: strong); drag across scrubs training; a click replays
        pointer(type, x, y, st) {
            if (type === 'move' && !st.press && x > st.chart.x0 - 10) { st.wd = Math.max(0, Math.min(1, 1 - (y - st.chart.y0) / (st.chart.y1 - st.chart.y0))); st.wake = Math.max(st.wake || 0, 0.3); }
            if (type === 'down') st.press = { x, moved: false };
            else if (type === 'move' && st.press) { if (Math.abs(x - st.press.x) > 3) st.press.moved = true; if (st.press.moved) { st.anim = null; st.u = Math.max(0, Math.min(1, (x - st.chart.x0) / (st.chart.x1 - st.chart.x0))); st.wake = 0.5; } }
            else if (type === 'up' && st.press) { if (!st.press.moved) { st.anim = { start: null }; st.wake = 5.2; } st.press = null; }
        },
        draw(ctx, R, t, C, st, still) {
            if (st.anim && !still) { if (st.anim.start == null) st.anim.start = t; const e = (t - st.anim.start) / 5; st.u = Math.min(1, e); if (e >= 1) st.anim = null; }
            const { P: p, FREQ } = F.grokking, u = st.u, E = st.emb, ch = st.chart;
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            // embeddings: random, wandering while the net memorises, then pulled onto the clock as it generalises
            const ga = F.grokking.grokAt(st.wd), circ = smooth((u - (ga - 0.14)) / 0.22), wander = Math.min(1, u / 0.3) * (1 - circ);
            const pos = st.start.map(([x, y], a) => {
                const [p1, p2, s2] = st.drift[a], wx = x + 0.25 * wander * Math.sin(u * 9 * s2 + p1), wy = y + 0.25 * wander * Math.cos(u * 8 * s2 + p2);
                const ang = (TAU * FREQ * a) / p, cx = Math.cos(ang), cy = Math.sin(ang);
                return [E.x + (wx + (cx - wx) * circ) * E.rad, E.y - (wy + (cy - wy) * circ) * E.rad];
            });
            ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.35 * circ;
            for (let k = 0; k < 64; k++) { const a = (k / 64) * TAU; ctx.fillRect(E.x + Math.cos(a) * E.rad - 0.5, E.y + Math.sin(a) * E.rad - 0.5, 1, 1); }
            // consecutive numbers joined faintly: a tangle that becomes a regular star
            for (let a = 0; a < p; a++) { const [x0, y0] = pos[a], [x1, y1] = pos[(a + 1) % p], n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6)); for (let k = 1; k < n; k++) dot(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, 0.45, 0.25, C.ink3); }
            pos.forEach(([x, y], a) => { dot(x, y, a === 0 ? 3 : 2.1, 1, C.ink); label(ctx, C, st, String(a), x + (x - E.x) * 0.14, y + (y - E.y) * 0.14, 'center'); });
            // accuracy curves
            ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.5; for (let x = ch.x0; x <= ch.x1; x += 4) ctx.fillRect(x - 0.5, ch.y1 - 0.5, 1, 1); for (let y = ch.y0; y <= ch.y1; y += 4) ctx.fillRect(ch.x0 - 0.5, y - 0.5, 1, 1);
            const X = (v) => ch.x0 + v * (ch.x1 - ch.x0), Y = (a) => ch.y1 - a * (ch.y1 - ch.y0);
            for (let k = 0; k <= 120; k++) { const v = k / 120; if (v > u) break; dot(X(v), Y(F.grokking.accTrain(v)), 0.9, 0.55, C.ink2); dot(X(v), Y(F.grokking.accTest(v, st.wd)), 1.2, 0.95, C.ink); }
            // weight decay: a scale at the right edge with a handle
            const wx = ch.x1 + 6, wy = ch.y1 - st.wd * (ch.y1 - ch.y0);
            vslider(ctx, C, st, wx, ch.y1, ch.y0, st.wd, `weight decay ${st.wd.toFixed(2)}`);
            ctx.globalAlpha = 1; ctx.fillStyle = C.ink; ctx.fillRect(X(u) - 0.5, ch.y0, 1, ch.y1 - ch.y0);
            label(ctx, C, st, 'number embeddings (mod 23)', E.x, st.vy0 - 2, 'center', true);
            label(ctx, C, st, 'train', X(0.3), Y(F.grokking.accTrain(0.3)) - 9, 'center');
            label(ctx, C, st, 'test', X(Math.min(u, 0.95)), Y(F.grokking.accTest(Math.min(u, 0.95), st.wd)) + 10, 'center', true);
            label(ctx, C, st, ga > 1 ? 'no weight decay: memorises, never groks' : u < ga - 0.12 ? 'memorised: train 100%, test at chance' : u < ga + 0.06 ? 'grokking' : 'generalised: a clock', ch.x1, ch.y0 - 6, 'right', true);
            label(ctx, C, st, 'training steps (log)', ch.x0, ch.y1 + 10, 'left'); label(ctx, C, st, 'illustrative', ch.x1, ch.y1 + 10, 'right');
            if (!still && (st.anim || st.press)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // Convolution (the first layers of AlexNet, Krizhevsky et al.): a 3×3 filter slides over an image and
    // every position gives one value of the feature map, ReLU(patch · filter). The image is a dot screen;
    // the filter's weights are drawn filled (positive) or as rings (negative). A click cycles the filter
    // (vertical edges, horizontal edges, a diagonal, blur, sharpen) and the filter sweeps the image again;
    // drawing on the image updates the map; pointing at the map shows the patch each value sees.
    F.conv = {
        bleed: true, NX: 22, NY: 16,
        FILTERS: [
            ['vertical edges', [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]],
            ['horizontal edges', [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]],
            ['diagonal', [[0, 1, 2], [-1, 0, 1], [-2, -1, 0]]],
            ['blur', [[1, 2, 1], [2, 4, 2], [1, 2, 1]].map((r2) => r2.map((v) => v / 4))],
            ['sharpen', [[0, -1, 0], [-1, 5, -1], [0, -1, 0]]],
        ],
        init(R) {
            const fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = (R.vy1 ?? R.y + R.h) - 4, W = R.x + R.w - fx, { NX, NY } = F.conv;
            const cell = Math.floor(Math.min((W - 100) / (2 * NX), (vy1 - vy0) / NY));
            const img = new Float32Array(NX * NY);
            // a ring, a bar and a corner: edges in every direction
            for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
                const d = Math.hypot(x - 7, y - 8); let v = Math.abs(d - 4.5) < 1 ? 1 : 0;
                if (x >= 14 && x <= 19 && y >= 3 && y <= 4) v = 1; if (x >= 14 && x <= 15 && y >= 3 && y <= 12) v = 1; if (y >= 11 && y <= 12 && x >= 14 && x <= 20) v = 0.6;
                img[y * NX + x] = v;
            }
            const inp = { x: fx + 4, y: vy0 + (vy1 - vy0 - NY * cell) / 2 }, out = { x: fx + W - 4 - (NX - 2) * cell, y: inp.y + cell };
            return { fx, vy0, vy1, W, cell, img, inp, out, f: 0, sweep: 1, anim: null, probe: null, filt: { x: inp.x + NX * cell + (out.x - inp.x - NX * cell) / 2 - cell * 1.5, y: inp.y + (NY * cell) / 2 - cell * 1.5 } };
        },
        value(st, x, y) {                                                                    // ReLU of the filter on the patch centred at (x, y)
            const k = F.conv.FILTERS[st.f][1], { NX } = F.conv; let s2 = 0;
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s2 += k[j + 1][i + 1] * st.img[(y + j) * NX + x + i];
            return Math.max(0, s2);
        },
        pointer(type, x, y, st) {
            const { NX, NY } = F.conv, c = st.cell;
            const ix = Math.floor((x - st.inp.x) / c), iy = Math.floor((y - st.inp.y) / c), inImg = ix >= 0 && iy >= 0 && ix < NX && iy < NY;
            const ox = Math.floor((x - st.out.x) / c) + 1, oy = Math.floor((y - st.out.y) / c) + 1, inOut = ox >= 1 && oy >= 1 && ox < NX - 1 && oy < NY - 1;
            if (type === 'leave') { st.probe = null; return; }
            if (type === 'move') { st.probe = inOut ? [ox, oy] : null; st.wake = Math.max(st.wake || 0, 0.2); }
            if (type === 'down') { st.press = { x, y, moved: false }; if (inImg) { st.img[iy * NX + ix] = 1; st.press.paint = true; } }
            if (type === 'move' && st.press && st.press.paint && inImg) { st.img[iy * NX + ix] = 1; st.press.moved = true; st.wake = 0.5; }
            if (type === 'up' && st.press) { if (!st.press.paint) { st.f = (st.f + 1) % F.conv.FILTERS.length; st.anim = { start: null }; st.wake = 3.2; } st.press = null; }
        },
        draw(ctx, R, t, C, st, still) {
            const { NX, NY } = F.conv, c = st.cell;
            if (st.anim && !still) { if (st.anim.start == null) st.anim.start = t; const e = (t - st.anim.start) / 2.8; st.sweep = Math.min(1, e); if (e >= 1) st.anim = null; }
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            // the input image as a dot screen
            for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const v = st.img[y * NX + x]; dot(st.inp.x + (x + 0.5) * c, st.inp.y + (y + 0.5) * c, 0.45 + v * c * 0.32, v > 0 ? 0.85 : 0.2, v > 0 ? C.ink : C.ink3); }
            // the feature map, built up to the sweep position
            const total = (NX - 2) * (NY - 2), upto = Math.floor(st.sweep * total);
            let vmax = 0; for (let y = 1; y < NY - 1; y++) for (let x = 1; x < NX - 1; x++) vmax = Math.max(vmax, F.conv.value(st, x, y));
            for (let y = 1; y < NY - 1; y++) for (let x = 1; x < NX - 1; x++) {
                const idx = (y - 1) * (NX - 2) + (x - 1), px = st.out.x + (x - 1 + 0.5) * c, py = st.out.y + (y - 1 + 0.5) * c;
                if (idx >= upto) { dot(px, py, 0.4, 0.15, C.ink3); continue; }
                const v = F.conv.value(st, x, y) / (vmax || 1); dot(px, py, 0.45 + v * c * 0.38, v > 0.02 ? 0.3 + 0.65 * v : 0.18, v > 0.02 ? C.ink : C.ink3);
            }
            // the window: on the input, where the sweep is (or the probed patch), and the matching output cell
            const at = st.probe || (st.sweep < 1 ? [1 + (upto % (NX - 2)), 1 + Math.floor(upto / (NX - 2))] : null);
            if (at) {
                const [x, y] = at;
                dotRect(ctx, st.inp.x + (x - 1) * c, st.inp.y + (y - 1) * c, 3 * c, 3 * c, 2.5, 1.1, C.ink, 0.9);
                dotRect(ctx, st.out.x + (x - 1) * c, st.out.y + (y - 1) * c, c, c, 2, 1.1, C.ink, 0.9);
            }
            // the filter: nine weights, filled positive, rings negative
            const k = F.conv.FILTERS[st.f][1], fc = c * 1.1, km = Math.max(...k.flat().map(Math.abs));
            for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const w = k[j][i] / km, x = st.filt.x + (i + 0.5) * fc, y = st.filt.y + (j + 0.5) * fc, r2 = 0.6 + Math.abs(w) * fc * 0.38; if (w >= 0) dot(x, y, r2, 0.95, C.ink); else { ctx.globalAlpha = 0.95; ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.stroke(); } }
            dotRect(ctx, st.filt.x, st.filt.y, 3 * fc, 3 * fc, 2.5, 0.8, C.ink3, 0.7);
            label(ctx, C, st, 'input', st.inp.x + (NX * c) / 2, st.inp.y - 8, 'center');
            label(ctx, C, st, `3×3 filter: ${F.conv.FILTERS[st.f][0]}`, st.filt.x + 1.5 * fc, st.filt.y - 10, 'center', true);
            label(ctx, C, st, 'feature map = ReLU(input ∗ filter)', st.out.x + ((NX - 2) * c) / 2, st.out.y - 8 - c, 'center');
            label(ctx, C, st, 'click: next filter · drag on the image: draw', st.fx + st.W - 6, st.vy1 + 10, 'right');
            if (!still && (st.anim || st.press)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // Backpropagation, one step at a time (Rumelhart, Hinton & Williams): a 2 → 5 → 5 → 1 network beside
    // its decision boundary. A click on the network plays one training step for the highlighted point:
    // forward, activations flow left to right and fill the neurons; loss, the error appears at the output;
    // backward, the error flows right to left, each connection pulsing with the size of its gradient;
    // update, the weights change and the boundary moves. A click in the field adds a point the network
    // gets wrong (and makes it the highlighted one), then the network trains for a few seconds.
    F.backprop2 = {
        bleed: true, SIZES: [2, 5, 5, 1], STEP: 3.2,
        title: 'Backpropagation', note: 'One training step played out: forward pass, loss, gradients flowing backward, weight update.',
        init(R, rand) {
            const st = F.backprop.init(R, rand);
            const r = rand(71), g = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
            const S = F.backprop2.SIZES; st.net = [];
            for (let l = 1; l < S.length; l++) st.net.push({ W: Array.from({ length: S[l] }, () => Array.from({ length: S[l - 1] }, () => g() * 0.9)), b: Array.from({ length: S[l] }, () => g() * 0.1) });
            st.mask = st.net.map((L) => L.W.map((row) => row.map(() => 1))); st.vel = null;
            for (let k = 0; k < 900; k++) F.backprop.step(st);                                     // part-trained: room to improve
            st.focus = st.data.length - 1; st.play = null;
            return st;
        },
        // gradients of the loss on one point: activations, the error signal δ per neuron, and dL/dw per weight
        grads(st, [x, y, c]) {
            const acts = F.backprop.forward(st, [x, y]), deltas = [], gw = st.net.map((L) => L.W.map((row) => row.map(() => 0)));
            let delta = [acts[acts.length - 1][0] - c];
            for (let l = st.net.length - 1; l >= 0; l--) {
                deltas[l + 1] = delta; const prev = acts[l];
                delta.forEach((d, j) => prev.forEach((a, i) => (gw[l][j][i] = d * a)));
                delta = prev.map((a, i) => st.net[l].W.reduce((s2, row, j) => s2 + row[i] * delta[j], 0) * (1 - a * a));
            }
            deltas[0] = delta;
            return { acts, deltas, gw };
        },
        pointer(type, x, y, st, R) {
            if (type === 'down' && x < st.field.x0 - 4) { st.play = { start: null, g: F.backprop2.grads(st, st.data[st.focus]) }; st.wake = F.backprop2.STEP + 0.4; return; }
            const before = st.data.length;
            F.backprop.pointer(type, x, y, st, R);
            if (st.data.length !== before) st.focus = st.data.length - 1;
        },
        draw(ctx, R, t, C, st, still) {
            const dt = Math.min(0.05, Math.max(0, t - (st.tl ?? t))); st.tl = t;
            if (!still && st.train > 0) { st.train -= dt; for (let k = 0; k < 10; k++) F.backprop.step(st); }
            let phase = null, e = 0;
            if (st.play && !still) {
                if (st.play.start == null) st.play.start = t;
                e = (t - st.play.start) / F.backprop2.STEP;
                phase = e < 0.33 ? 'forward' : e < 0.45 ? 'loss' : e < 0.8 ? 'backward' : e < 1 ? 'update' : null;
                if (e >= 0.8 && !st.play.applied) { for (let k = 0; k < 40; k++) F.backprop.step(st); st.play.applied = true; }   // the update: a visible step
                if (e >= 1) st.play = null;
            }
            const f = st.field, live = st.touched;
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            // the field: prediction as a dot screen, the boundary traced, the data
            const NX = 26, NY = 12, P = [];
            for (let j = 0; j <= NY; j++) { P.push([]); for (let i = 0; i <= NX; i++) P[j].push(F.backprop.forward(st, [(i / NX) * 2 - 1, 1 - (j / NY) * 2]).pop()[0]); }
            for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
                const p = P[j][i], [x, y] = F.backprop.fromField(st, (i / NX) * 2 - 1, 1 - (j / NY) * 2), c = Math.abs(p - 0.5) * 2;
                dot(x, y, 0.5 + (p > 0.5 ? 1.2 : 0.5) * c, p > 0.5 ? 0.16 + 0.3 * c : 0.1 + 0.16 * c, p > 0.5 ? C.ink2 : C.ink3);
                if (i < NX && (P[j][i] - 0.5) * (P[j][i + 1] - 0.5) < 0) { const a = (0.5 - P[j][i]) / (P[j][i + 1] - P[j][i]), [bx] = F.backprop.fromField(st, ((i + a) / NX) * 2 - 1, 0); dot(bx, y, 1.2, 0.9, C.ink); }
                if (j < NY && (P[j][i] - 0.5) * (P[j + 1][i] - 0.5) < 0) { const a = (0.5 - P[j][i]) / (P[j + 1][i] - P[j][i]), [, by] = F.backprop.fromField(st, 0, 1 - ((j + a) / NY) * 2); dot(x, by, 1.2, 0.9, C.ink); }
            }
            st.data.forEach(([u, v, c], k) => { const [x, y] = F.backprop.fromField(st, u, v); if (c) dot(x, y, 2.4, 1, C.ink); else { ctx.globalAlpha = 1; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(x, y, 2.3, 0, TAU); ctx.stroke(); } if (k === st.focus) { ctx.globalAlpha = 0.9; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke(); } });
            // the network
            const S = F.backprop2.SIZES, nb = st.netbox, gd = st.play ? st.play.g : null;
            const pos = (l, j) => [nb.x0 + (l / (S.length - 1)) * (nb.x1 - nb.x0), nb.y0 + ((j + 0.5) / S[l]) * (nb.y1 - nb.y0)];
            let wmax = 0, gmax = 0; st.net.forEach((L, l) => L.W.forEach((row, j) => row.forEach((w, i) => { wmax = Math.max(wmax, Math.abs(w)); if (gd) gmax = Math.max(gmax, Math.abs(gd.gw[l][j][i])); })));
            const layerOf = (pe, dir) => dir > 0 ? pe * (S.length - 1) : (1 - pe) * (S.length - 1);    // how far a pulse has travelled, in layers
            st.net.forEach((L, l) => L.W.forEach((row, j) => row.forEach((w, i) => {
                const [x0, y0] = pos(l, i), [x1, y1] = pos(l + 1, j), m = Math.abs(w) / (wmax || 1), n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4));
                for (let k = 1; k < n; k++) dot(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, 0.35 + 0.7 * m, 0.1 + 0.45 * m, w > 0 ? C.ink2 : C.ink3);
                // forward: a pulse rides each connection left to right; backward: right to left, sized by the gradient
                if (phase === 'forward') { const at = layerOf(e / 0.33, 1) - l; if (at > 0 && at < 1) dot(x0 + (x1 - x0) * at, y0 + (y1 - y0) * at, 1.3, 0.8, C.ink2); }
                if (phase === 'backward') { const at = layerOf((e - 0.45) / 0.35, -1) - l, gm = Math.abs(gd.gw[l][j][i]) / (gmax || 1); if (at > 0 && at < 1) dot(x0 + (x1 - x0) * at, y0 + (y1 - y0) * at, 0.8 + 2.6 * gm, 0.3 + 0.7 * gm, C.ink); }
            })));
            S.forEach((n, l) => { for (let j = 0; j < n; j++) {
                const [x, y] = pos(l, j); dot(x, y, 3.6, 1, C.bg || '#fff'); ctx.globalAlpha = 0.9; ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 3.6, 0, TAU); ctx.stroke();
                if (gd) {
                    const reached = phase === 'forward' ? layerOf(e / 0.33, 1) >= l : true, a = Math.abs(gd.acts[l][j]);
                    if (reached && phase) dot(x, y, 3 * Math.min(1, a), 1, C.ink);
                    const back = phase === 'backward' ? layerOf((e - 0.45) / 0.35, -1) <= l : phase === 'update' || phase === 'loss' ? l === S.length - 1 : false;
                    if (back && gd.deltas[l]) { const dm = Math.min(1, Math.abs(gd.deltas[l][j]) * 4); ctx.globalAlpha = 0.9; ctx.lineWidth = 1 + 1.5 * dm; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, 6 + 3 * dm, 0, TAU); ctx.stroke(); }
                } else if (st.probe) { const acts = F.backprop.forward(st, st.probe); dot(x, y, 3 * Math.abs(acts[l][j]), 1, C.ink); }
            } });
            if (st.probe) { const [x, y] = F.backprop.fromField(st, st.probe[0], st.probe[1]); ctx.globalAlpha = 0.9; ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.stroke(); }
            const stage = { forward: '1 · forward pass', loss: '2 · loss at the output', backward: '3 · backward: ∂L/∂w flows back', update: '4 · update: w ← w − η ∂L/∂w' }[phase];
            label(ctx, C, st, stage || 'network 2 → 5 → 5 → 1 · click: one step', nb.x0 - 2, st.vy0 - 2, 'left', !!stage);
            label(ctx, C, st, 'decision boundary', f.x0 + 4, st.vy0 - 2, 'left', true);
            label(ctx, C, st, 'click: add a point it gets wrong', f.x1, st.vy1 + 6, 'right');
            if (!still && (st.train > 0 || st.play)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // ResNet (He et al.), drawn the way Welch Labs draws it, in 3D: the input image on a plane, then the
    // network as cuboids (feature maps: shrinking in height and width, deepening in channels along the row),
    // activations as strokes of dots inside, skip connections arcing over each pair of blocks into a ⊕, a
    // thin output slab. Drag to orbit the camera. Hover a block to see a neuron's data streams: the patch
    // of the previous layer it reads, its receptive field widening back to the image, and where it feeds.
    // A click runs a forward pass, then the gradient flows back (a bar under each block). A click on a ⊕
    // removes that skip: gradients then shrink through the plain blocks, the vanishing gradient.
    F.resnet = {
        bleed: true,
        title: 'ResNet', note: 'Residual blocks in 3D: orbit by dragging, hover for a neuron’s receptive field, click for a pass; remove a skip and gradients vanish.',
        LAYERS: [['stem: conv 7×7, 64 channels', 1.0, 8], ['conv 3×3, 64 channels', 0.74, 18], ['conv 3×3, 64 channels', 0.74, 18], ['conv 3×3, 128 channels', 0.5, 24], ['conv 3×3, 128 channels', 0.5, 24],
                 ['conv 3×3, 256 channels', 0.3, 32], ['conv 3×3, 256 channels', 0.3, 32]],
        // input images on a 12×12 grid, (y, z) ∈ [−1, 1], y up: a new one for every pass
        IMAGES: [
            (y, z) => { const d = Math.hypot(y, z); return d > 0.35 && d < 0.7; },                                         // ring
            (y, z) => (y > 0.45 && y < 0.75 && Math.abs(z) < 0.6) || (Math.abs(z - (0.45 - (0.6 - y) * 0.5)) < 0.17 && y < 0.6 && y > -0.8),   // a seven
            (y, z) => Math.abs(y) < 0.18 || Math.abs(z) < 0.18,                                                           // cross
            (y, z) => Math.max(Math.abs(y), Math.abs(z)) < 0.7 && Math.max(Math.abs(y), Math.abs(z)) > 0.42,              // square
            (y, z) => Math.abs(y - z) < 0.25,                                                                            // diagonal
            (y, z) => (y > 0.45 && y < 0.75 && Math.abs(z) < 0.7) || (Math.abs(z) < 0.17 && y < 0.6 && y > -0.75),                 // a T
        ],
        init(R, rand) {
            const r = rand(73), x0 = (R.fx ?? R.x) + 4, x1 = R.x + R.w - 8, vy0 = (R.vy0 ?? R.y) + 16, vy1 = (R.vy1 ?? R.y + R.h) - 18;
            // world units: x along the row, y up, z depth; cross-sections are square (height = width of the feature map)
            const H = 100, gap = 14, Ls = F.resnet.LAYERS; let x = 34;
            const boxes = Ls.map(([name, h, len], i) => { const b = { name, x, len: len * 2.4, h: h * H, i, seeds: Array.from({ length: 24 }, () => [r(), r(), r()]) }; x += b.len + gap; return b; });
            const out = { x: x + 4, h: H * 0.42 }, img = { x: 0, h: H * 1.1 };
            const skips = [[1, 2], [3, 4], [5, 6]].map(([a, b2]) => ({ a, b: b2, on: true }));
            return { x0, x1, vy0, vy1, H, boxes, out, img, skips, yaw: 0.7, pitch: 0.78, play: null, imgK: 0, hoverBox: -1, hoverSkip: -1, neuron: null, span: x + 20 };
        },
        // an oblique camera, as in a technical drawing: the row stays horizontal, depth recedes along an axis at
        // angle yaw with length pitch; dragging swings and stretches that axis. Scaled and centred to fit the band.
        cam(st) {
            const kx = Math.cos(st.yaw) * st.pitch, ky = Math.sin(st.yaw) * st.pitch, xc = st.span / 2;
            const raw = (x, y, z) => [(x - xc) + z * kx, -y - z * ky];
            if (!st.fit || st.fit.yaw !== st.yaw || st.fit.pitch !== st.pitch) {
                let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
                const take = (x, y, z) => { const [X, Y] = raw(x, y, z); a = Math.min(a, X); b = Math.max(b, X); c = Math.min(c, Y); d = Math.max(d, Y); };
                [[0, st.img.h], ...st.boxes.map((B) => [B.x, B.h]), [st.boxes[st.boxes.length - 1].x + st.boxes[st.boxes.length - 1].len, st.boxes[st.boxes.length - 1].h], [st.out.x, st.out.h]].forEach(([x, h]) => [-1, 1].forEach((sy2) => [-1, 1].forEach((sz) => take(x, (sy2 * h) / 2, (sz * h) / 2))));
                take(st.span / 2, st.boxes[1].h / 2 + 26, 0);
                const s2 = Math.min((st.x1 - st.x0) / (b - a), (st.vy1 - st.vy0) / (d - c));
                st.fit = { yaw: st.yaw, pitch: st.pitch, s: s2, ox: (st.x0 + st.x1) / 2 - ((a + b) / 2) * s2, oy: (st.vy0 + st.vy1) / 2 - ((c + d) / 2) * s2 };
            }
            const f = st.fit; return (x, y, z) => { const [X, Y] = raw(x, y, z); return [f.ox + X * f.s, f.oy + Y * f.s]; };
        },
        // the forward pass as streams: threads from points on the image through a point in every block to the
        // output, each entering a block near where it sat in the one before, so the bundle narrows with the maps
        streams(st) {
            const r = Math.random, out = [];
            for (let q = 0; q < 52; q++) {
                let u, v, tries = 0; do { u = r() * 1.9 - 0.95; v = r() * 1.9 - 0.95; tries++; } while (!F.resnet.IMAGES[st.imgK](u, v) && tries < 60);   // start on an inked pixel
                const pts = [[0, (u * st.img.h) / 2, (v * st.img.h) / 2]];
                st.boxes.forEach((B) => { u = Math.max(-1, Math.min(1, u * 0.9 + (r() - 0.5) * 0.35)); v = Math.max(-1, Math.min(1, v * 0.9 + (r() - 0.5) * 0.35)); pts.push([B.x + B.len * (0.2 + 0.6 * r()), (u * B.h) / 2 * 0.8, (v * B.h) / 2 * 0.8]); });
                pts.push([st.out.x, (r() - 0.5) * st.out.h * 0.8, 0]);
                out.push({ pts, a: 0.35 + 0.5 * r() });
            }
            return out;
        },
        grads(st) {
            const n = st.boxes.length, g = new Array(n).fill(0); let cur = 1;
            for (let i = n - 1; i >= 0; i--) { g[i] = cur; const sk = st.skips.find((s2) => s2.a === i || s2.b === i); cur *= sk && sk.on ? 0.96 : 0.58; }
            return g;
        },
        skipPts(st, s2) { const A = st.boxes[s2.a], B = st.boxes[s2.b], nx = st.boxes[s2.b + 1] ? st.boxes[s2.b + 1].x : st.out.x, top = A.h / 2 + 16; return { xa: A.x - 5, xb: (B.x + B.len + nx) / 2, top }; },
        pointer(type, x, y, st) {
            if (type === 'leave') { st.hoverBox = -1; st.hoverSkip = -1; st.neuron = null; return; }
            const P = F.resnet.cam(st);
            if (type === 'down') { st.press = { x, y, yaw: st.yaw, pitch: st.pitch, moved: false }; return; }
            if (type === 'move' && st.press) {
                if (Math.hypot(x - st.press.x, y - st.press.y) > 4) st.press.moved = true; st.press.lx = x; st.press.ly = y;
                if (st.press.moved) { st.yaw = Math.max(-1.3, Math.min(1.3, st.press.yaw - (y - st.press.y) * 0.008)); st.pitch = Math.max(0.15, Math.min(1.6, st.press.pitch + (x - st.press.x) * 0.006)); st.neuron = null; st.wake = 0.4; }
                return;
            }
            if (type === 'up' && st.press) {
                const moved = st.press.moved; st.press = null; if (moved) return;
                if (st.hoverSkip >= 0) { st.skips[st.hoverSkip].on = !st.skips[st.hoverSkip].on; st.play = { start: null, back: true }; st.wake = 2.6; }
                else { st.imgK = (st.imgK + 1) % F.resnet.IMAGES.length; st.boxes.forEach((B) => B.seeds.forEach((sd) => { sd[0] = Math.random(); sd[1] = Math.random(); sd[2] = Math.random(); })); st.play = { start: null }; st.flow = { pts: F.resnet.streams(st), end: null }; st.wake = 6; }
                return;
            }
            // hover: a ⊕, or a neuron inside a block (its height from the pointer, a fixed depth)
            st.hoverSkip = st.skips.findIndex((s2) => { const g2 = F.resnet.skipPts(st, s2), [px, py] = P(g2.xb, g2.top * 0.55, 0); return Math.hypot(x - px, y - py) < 10; });
            st.hoverBox = -1; st.neuron = null;
            st.boxes.forEach((B, i) => { const [a] = P(B.x, 0, 0), [b] = P(B.x + B.len, 0, 0), [, ty] = P(B.x + B.len / 2, B.h / 2, 0), [, by] = P(B.x + B.len / 2, -B.h / 2, 0); if (x >= Math.min(a, b) - 3 && x <= Math.max(a, b) + 3 && y >= ty - 4 && y <= by + 4) { st.hoverBox = i; st.neuron = { i, u: Math.max(-0.9, Math.min(0.9, 1 - 2 * (y - ty) / Math.max(1, by - ty))), w: 0.25, f: Math.max(0.1, Math.min(0.9, (x - Math.min(a, b)) / Math.max(1, Math.abs(b - a)))) }; } });
            st.wake = Math.max(st.wake || 0, 0.25);
        },
        draw(ctx, R, t, C, st, still) {
            const P = F.resnet.cam(st);
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            const seg = (A, B, step, size, a, col) => { const n = Math.max(2, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / step)); for (let i = 0; i <= n; i++) dot(A[0] + ((B[0] - A[0]) * i) / n, A[1] + ((B[1] - A[1]) * i) / n, size, a, col); };
            const L3 = (a, b, step, size, al, col) => seg(P(...a), P(...b), step, size, al, col);
            let fw = 1, bw = 1;
            if (st.play && !still) { if (st.play.start == null) st.play.start = t; const e = (t - st.play.start) / (st.play.back ? 2.2 : 4); if (st.play.back) bw = Math.min(1, e); else { fw = Math.min(1, e / 0.55); bw = Math.max(0, Math.min(1, (e - 0.55) / 0.45)); } if (e >= 1) st.play = null; }
            const playing = st.play && !still, front = fw * (st.out.x + 10), back = st.out.x - bw * st.out.x, g = F.resnet.grads(st);
            // the image plane with a dot-screen picture
            const ih = st.img.h / 2;
            [[-1, -1, -1, 1], [-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1]].forEach(([a, b, c, d]) => L3([0, a * ih, b * ih], [0, c * ih, d * ih], 3, 0.6, 0.7, C.ink2));
            for (let j = 0; j < 12; j++) for (let k = 0; k < 12; k++) { const yy = ih - ((j + 0.5) / 12) * 2 * ih, zz = -ih + ((k + 0.5) / 12) * 2 * ih, on = F.resnet.IMAGES[st.imgK](yy / ih, zz / ih); const [px, py] = P(0, yy, zz); dot(px, py, on ? 1.2 : 0.5, on ? 0.85 : 0.2, on ? C.ink : C.ink3); }
            // the thread
            L3([0, 0, 0], [st.out.x, 0, 0], 3, 0.6, 0.4, C.ink3);
            if (playing && fw < 1) L3([0, 0, 0], [Math.min(front, st.out.x), 0, 0], 2, 1, 0.9, C.ink);
            // boxes: twelve edges each, activations inside, the gradient bar beneath
            st.boxes.forEach((B, i) => {
                const h = B.h / 2, x0 = B.x, x1 = B.x + B.len, lit = !playing || B.x < front, hov = i === st.hoverBox, col = hov ? C.ink : C.ink2, a = hov ? 0.95 : 0.7;
                const V = (x, sy2, sz) => [x, sy2 * h, sz * h];
                [[-1, -1], [-1, 1], [1, 1], [1, -1]].forEach(([p, q]) => L3(V(x0, p, q), V(x1, p, q), 3, 0.5, a * 0.8, col));
                [x0, x1].forEach((x) => [[-1, -1, -1, 1], [-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1]].forEach(([p, q, p2, q2]) => L3(V(x, p, q), V(x, p2, q2), 3, 0.5, a, col)));
                B.seeds.forEach(([p, q, s2], k) => { if (k > 5 + B.h * 0.12) return; const sx = x0 + p * B.len, sy2 = (s2 * 2 - 1) * h * 0.85, sz = (q * 2 - 1) * h * 0.85; for (let m = 0; m < 4; m++) { const [px, py] = P(sx + m * 2.2, sy2 + m * 1.5, sz); dot(px, py, 0.5, lit ? 0.45 : 0.12, lit ? C.ink2 : C.ink3); } });
                const gv = !playing || x1 > back ? g[i] : 0, gn = Math.round(gv * 9), base = -st.boxes[0].h / 2 - 10;
                for (let m = 0; m < gn; m++) { const [px, py] = P(B.x + B.len / 2, base - m * 4.5, 0); dot(px, py, 0.95, 0.85, C.ink); }
            });
            // streams of the forward pass: grown with the pulse, held, then faded
            if (st.flow && !still) {
                if (!playing && st.flow.end == null) st.flow.end = t;
                const fade = st.flow.end == null ? 1 : 1 - Math.min(1, (t - st.flow.end) / 1.6);
                if (fade <= 0) st.flow = null;
                else st.flow.pts.forEach(({ pts, a }) => {
                    for (let k = 0; k < pts.length - 1; k++) {
                        const A2 = pts[k], B2 = pts[k + 1]; if (A2[0] > front) break;
                        const f = Math.min(1, (front - A2[0]) / Math.max(1, B2[0] - A2[0])), E = [A2[0] + (B2[0] - A2[0]) * f, A2[1] + (B2[1] - A2[1]) * f, A2[2] + (B2[2] - A2[2]) * f];
                        L3(A2, E, 3.2, 0.5, a * fade * 0.8, C.ink2);
                        if (f < 1 && playing) { const [px, py] = P(...E); dot(px, py, 1.3, a * fade, C.ink); }
                    }
                });
            }
            // the output slab
            const oh = st.out.h / 2; [[-1, -1, -1, 1], [-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1]].forEach(([a, b, c, d]) => L3([st.out.x, a * oh, b * 3], [st.out.x, c * oh, d * 3], 2.5, 0.6, 0.8, C.ink2));
            if (!playing || front > st.out.x) for (let m = 0; m < 6; m++) { const [px, py] = P(st.out.x, oh - (m + 0.5) * (st.out.h / 6), 0); dot(px, py, 0.9, 0.8, C.ink); }
            // skips: up, across, down into a ⊕
            st.skips.forEach((s2, k) => {
                const g2 = F.resnet.skipPts(st, s2), on = s2.on, hov = k === st.hoverSkip, step = on ? 3 : 6, col = hov ? C.ink : on ? C.ink2 : C.ink3, a = on ? 0.9 : 0.5;
                L3([g2.xa, 0, 0], [g2.xa, g2.top, 0], step, 0.7, a, col); L3([g2.xa, g2.top, 0], [g2.xb, g2.top, 0], step, 0.7, a, col); L3([g2.xb, g2.top, 0], [g2.xb, g2.top * 0.55 + 5, 0], step, 0.7, a, col);
                const [cx, cyy] = P(g2.xb, g2.top * 0.55, 0); for (let m = 0; m < 16; m++) { const an = (m / 16) * TAU; dot(cx + 4.5 * Math.cos(an), cyy + 4.5 * Math.sin(an), 0.6, a, col); }
                if (on) { seg([cx - 2.5, cyy], [cx + 2.5, cyy], 1.2, 0.55, a, col); seg([cx, cyy - 2.5], [cx, cyy + 2.5], 1.2, 0.55, a, col); }
                L3([g2.xb, g2.top * 0.55 - 5, 0], [g2.xb, 0, 0], step, 0.6, a * 0.7, col);
                if (playing && on && fw < 1 && front > g2.xa) { const f = Math.min(1, (front - g2.xa) / (g2.xb - g2.xa)); const [px, py] = P(g2.xa + (g2.xb - g2.xa) * f, g2.top, 0); dot(px, py, 1.6, 0.9, C.ink); }
                if (hov) label(ctx, C, st, on ? 'skip: x + F(x) · click to remove' : 'skip removed · click to restore', cx, cyy - 12, 'center', true);
            });
            // a neuron's data streams: its receptive field in every earlier layer, back to the image, and where it feeds
            if (st.neuron) {
                const { i, u, w, f } = st.neuron, B = st.boxes[i], nx = B.x + B.len * f, ny = (u * B.h) / 2, nz = (w * B.h) / 2, N = P(nx, ny, nz);
                const patch = (x, h, half) => { const cy0 = (u * h) / 2, cz0 = (w * h) / 2, e = half * h / 2; return [[x, cy0 - e, cz0 - e], [x, cy0 + e, cz0 - e], [x, cy0 + e, cz0 + e], [x, cy0 - e, cz0 + e]]; };
                for (let k = i - 1; k >= -1; k--) {
                    const h = k < 0 ? st.img.h : st.boxes[k].h, x = k < 0 ? 0 : st.boxes[k].x + st.boxes[k].len, half = Math.min(0.95, 0.12 + 0.17 * (i - k)), Q = patch(x, h, half), fade = 1 - (i - 1 - k) * 0.13;
                    Q.forEach((c, m) => { L3(c, Q[(m + 1) % 4], 2.2, 0.75, 0.9 * fade, C.ink); if (k === i - 1) seg(P(...c), N, 2.6, 0.6, 0.8, C.ink); });
                    if (k < i - 1) { const nxt = k + 1 === i ? null : patch(st.boxes[k + 1].x, st.boxes[k + 1].h, Math.min(0.95, 0.12 + 0.17 * (i - k - 1))); if (nxt) Q.forEach((c, m) => seg(P(...c), P(...nxt[m]), 3.2, 0.45, 0.45 * fade, C.ink2)); }
                }
                if (st.boxes[i + 1]) { const Bn = st.boxes[i + 1], Q = patch(Bn.x, Bn.h, 0.18); Q.forEach((c, m) => { L3(c, Q[(m + 1) % 4], 2.2, 0.6, 0.6, C.ink2); seg(N, P(...c), 3, 0.5, 0.5, C.ink2); }); }
                dot(N[0], N[1], 2.8, 1, C.ink);
                label(ctx, C, st, `${B.name} · receptive field back to the image`, N[0], N[1] - 12, 'center', true);
            } else { const hb = st.boxes[st.hoverBox]; if (hb) { const [px, py] = P(hb.x + hb.len / 2, hb.h / 2 + 6, 0); label(ctx, C, st, hb.name, px, py - 6, 'center', true); } }
            const [ix, iy] = P(0, -st.img.h / 2 - 8, 0); label(ctx, C, st, 'image', ix, iy, 'center');
            label(ctx, C, st, 'drag: orbit · hover: a neuron · click: pass', st.x1, st.vy0 - 10, 'right');
            if (!still && (st.play || st.flow)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // A GPU running a matrix multiply C = A × B, as a GEMM kernel does it. Right: the package (stylized after
    // a two-die design like Blackwell): two dies joined by a die-to-die link, each a grid of streaming
    // multiprocessors (SMs) split by an L2 band, HBM stacks above and below, NVLink at the edges. Left: A, B
    // and C in the usual layout, C cut into output tiles, one per SM per wave. Each wave: the K-loop, in which
    // every busy SM loads the next tile of its row of A and column of B (HBM → L2 → SM) and accumulates;
    // then the write-back, each finished tile of C returning to HBM. Drag C's corner to resize; when the tile
    // count is not a multiple of the SM count the last wave leaves SMs idle (wave quantization). Click the
    // chip to run; hover an SM to see the tile it owns and the slices of A and B it reads. Illustrative.
    F.gpu = {
        bleed: true, COLS: 9, ROWS: 8, MAXC: 16, MAXR: 12, K: 6,
        title: 'GPU', note: 'C = A × B as a GEMM kernel runs it: tiles per SM, the K-loop streaming A and B from HBM, write-back, waves. Illustrative.',
        init(R, rand) {
            const r = rand(79), fx = R.fx ?? R.x, vy0 = (R.vy0 ?? R.y) + 2, vy1 = (R.vy1 ?? R.y + R.h) - 8, W = R.x + R.w - fx;
            const mw = W * 0.33, { K, MAXC, MAXR } = F.gpu, s2 = Math.floor(Math.min((mw - 4) / (K + 1 + MAXC), (vy1 - vy0 - 6) / (K + 1 + MAXR)));
            const mat = { x: fx + 4, y: vy0 + 4, s: s2 };
            const cx0 = fx + mw + 28, gapD = 10, dw = (fx + W - 14 - cx0 - gapD) / 2, dh = (vy1 - vy0) * 0.56, dy = (vy0 + vy1) / 2 - dh / 2;
            const dies = [0, 1].map((d) => ({ x: cx0 + d * (dw + gapD), y: dy, w: dw, h: dh }));
            const { COLS, ROWS } = F.gpu, sms = [];
            dies.forEach((D, d) => { const cw = (D.w - 6) / COLS, band = 7, ch = (D.h - 6 - band) / ROWS; for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) sms.push({ d, x: D.x + 3 + i * cw, y: D.y + 3 + j * ch + (j >= ROWS / 2 ? band : 0), w: cw - 1.5, h: ch - 1.5 }); });
            const hbm = []; dies.forEach((D, d) => [0, 1].forEach((k) => [-1, 1].forEach((side) => hbm.push({ d, x: D.x + D.w * (0.1 + 0.48 * k), y: side < 0 ? D.y - 22 : D.y + D.h + 6, w: D.w * 0.36, h: 16 }))));
            return { r, fx, vy0, vy1, W, mat, dies, sms, hbm, mc: 12, mr: 14, run: null, part: null, hsm: -1 };
        },
        waves(st) { const n = st.sms.length, tiles = st.mc * st.mr, waves = Math.ceil(tiles / n); return { n, tiles, waves, last: tiles - (waves - 1) * n }; },
        geom(st) { const { K } = F.gpu, m = st.mat, s2 = m.s, cx = m.x + (K + 1) * s2, cy = m.y + (K + 1) * s2; return { s: s2, A: { x: m.x, y: cy }, B: { x: cx, y: m.y }, C: { x: cx, y: cy } }; },
        pointer(type, x, y, st) {
            if (type === 'enter') return;
            if (type === 'leave') { st.part = null; st.hsm = -1; return; }
            const G = F.gpu.geom(st), cxr = G.C.x + st.mc * G.s, cyr = G.C.y + st.mr * G.s, nearCorner = Math.hypot(x - cxr, y - cyr) < 12;
            const inMats = x < st.dies[0].x - 16;
            if (type === 'down') { st.press = { corner: nearCorner || inMats }; if (st.press.corner) st.run = null; }
            if ((type === 'move' || type === 'down') && st.press && st.press.corner) { st.mc = Math.max(1, Math.min(F.gpu.MAXC, Math.round((x - G.C.x) / G.s))); st.mr = Math.max(1, Math.min(F.gpu.MAXR, Math.round((y - G.C.y) / G.s))); st.wake = 0.4; }
            if (type === 'up' && st.press) { if (!st.press.corner) { const { waves } = F.gpu.waves(st); st.run = { start: null, per: Math.min(1.8, 6 / waves) }; st.wake = waves * st.run.per + 0.6; } st.press = null; }
            st.hsm = st.sms.findIndex((q) => x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h);
            st.part = nearCorner ? 'corner' : st.hsm >= 0 ? 'sm' : inMats ? 'matrix' : st.hbm.some((h) => x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.h) ? 'hbm' : st.dies.some((D) => x > D.x && x < D.x + D.w && y > D.y && y < D.y + D.h) ? 'l2' : x > st.dies[0].x + st.dies[0].w && x < st.dies[1].x ? 'link' : null;
            st.wake = Math.max(st.wake || 0, 0.2);
        },
        draw(ctx, R, t, C, st, still) {
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            const { n, tiles, waves, last } = F.gpu.waves(st), K = F.gpu.K, G = F.gpu.geom(st), s2 = G.s;
            // time: wave index, and within it the K-loop (0 → 0.75, step kk) then the write-back (0.75 → 1)
            let wave = waves, wf = 0;
            if (st.run && !still) { if (st.run.start == null) st.run.start = t; const e = (t - st.run.start) / st.run.per; wave = Math.floor(e); wf = e - wave; if (e >= waves) { st.run = null; wave = waves; wf = 0; } }
            const running = !!st.run && !still, busy = running ? (wave < waves - 1 ? n : last) : last;
            const loop = Math.min(1, wf / 0.75), kk = Math.min(K - 1, Math.floor(loop * K)), kf = loop * K - kk, back = running ? Math.max(0, (wf - 0.75) / 0.25) : 0;
            // the tile an SM owns (in this wave, or in the last one at rest), and the SM a tile runs on
            const ownWave = running ? wave : waves - 1, tileOf = (sm) => ownWave * n + sm;
            const hot = st.hsm >= 0 && tileOf(st.hsm) < tiles ? tileOf(st.hsm) : -1, hi = hot >= 0 ? hot % st.mc : -1, hj = hot >= 0 ? Math.floor(hot / st.mc) : -1;
            // A (mr × K), B (K × mc), C (mr × mc)
            const cell = (x, y, r2, a, col) => dot(x + s2 / 2, y + s2 / 2, r2, a, col);
            for (let j = 0; j < st.mr; j++) for (let k = 0; k < K; k++) { const on = running && wave < waves && k === kk && wf < 0.75, mine = j === hj; cell(G.A.x + k * s2, G.A.y + j * s2, on || mine ? s2 * 0.3 : s2 * 0.18, on ? 0.9 : mine ? 0.85 : 0.45, on || mine ? C.ink : C.ink2); }
            for (let k = 0; k < K; k++) for (let i = 0; i < st.mc; i++) { const on = running && wave < waves && k === kk && wf < 0.75, mine = i === hi; cell(G.B.x + i * s2, G.B.y + k * s2, on || mine ? s2 * 0.3 : s2 * 0.18, on ? 0.9 : mine ? 0.85 : 0.45, on || mine ? C.ink : C.ink2); }
            for (let q = 0; q < tiles; q++) {
                const i = q % st.mc, j = Math.floor(q / st.mc), w = Math.floor(q / n), x = G.C.x + i * s2, y = G.C.y + j * s2;
                const done = !running || w < wave || (w === wave && back >= 1), now = running && w === wave;
                if (done) cell(x, y, s2 * 0.34, w === waves - 1 && waves > 1 ? 0.55 : 0.9, w === waves - 1 && waves > 1 ? C.ink2 : C.ink);
                else if (now) cell(x, y, s2 * 0.34 * loop, 0.85, C.ink);
                else cell(x, y, 0.6, 0.35, C.ink3);
                if (q === hot) dotRect(ctx, x - 0.5, y - 0.5, s2 + 1, s2 + 1, 1.6, 0.7, C.ink, 1);
            }
            dotRect(ctx, G.A.x - 1, G.A.y - 1, K * s2 + 2, st.mr * s2 + 2, 2.5, 0.55, C.ink3, 0.7);
            dotRect(ctx, G.B.x - 1, G.B.y - 1, st.mc * s2 + 2, K * s2 + 2, 2.5, 0.55, C.ink3, 0.7);
            dotRect(ctx, G.C.x - 1, G.C.y - 1, st.mc * s2 + 2, st.mr * s2 + 2, 2.5, 0.6, C.ink2, 0.8);
            if (hot >= 0) { dotRect(ctx, G.A.x - 1, G.A.y + hj * s2 - 0.5, K * s2 + 2, s2 + 1, 1.6, 0.7, C.ink, 1); dotRect(ctx, G.B.x + hi * s2 - 0.5, G.B.y - 1, s2 + 1, K * s2 + 2, 1.6, 0.7, C.ink, 1); }
            const hx = G.C.x + st.mc * s2, hy = G.C.y + st.mr * s2, hc = st.part === 'corner' || (st.press && st.press.corner);
            for (let k = 0; k < 4; k++) { dot(hx + 3, hy - k * 3, 0.8, 0.9, C.ink); dot(hx - k * 3, hy + 3, 0.8, 0.9, C.ink); }
            dot(hx + 3, hy + 3, hc ? 3.2 : 2.2, 1, C.ink);
            // the chip
            st.dies.forEach((D) => { dotRect(ctx, D.x, D.y, D.w, D.h, 3, 1, C.ink2, 0.8); const by = D.y + 3 + (D.h - 6 - 7) / 2; for (let x = D.x + 5; x < D.x + D.w - 3; x += 2.5) for (let k = 0; k < 3; k++) dot(x, by + 1.2 + k * 2.2, 0.45, st.part === 'l2' ? 0.7 : 0.32, C.ink3); });
            const lx0 = st.dies[0].x + st.dies[0].w, lx1 = st.dies[1].x, ly = st.dies[0].y + st.dies[0].h / 2;
            for (let k = -6; k <= 6; k++) for (let x = lx0 + 2; x <= lx1 - 2; x += 3) dot(x, ly + k * 4, 0.5, st.part === 'link' ? 0.8 : 0.35, C.ink3);
            [st.dies[0].x - 7, st.dies[1].x + st.dies[1].w + 7].forEach((x) => { for (let k = 0; k < 10; k++) dot(x, st.dies[0].y + 6 + k * ((st.dies[0].h - 12) / 9), 0.9, 0.55, C.ink2); });
            st.hbm.forEach((h) => { for (let k = 0; k < 4; k++) dotRect(ctx, h.x + k * 1.2, h.y + k * 1.2 - 3, h.w, h.h - 6, 3, 0.7, C.ink2, st.part === 'hbm' ? 0.9 : 0.5); });
            st.sms.forEach((q, i) => {
                const active = i < busy, acc = !active ? 0 : running ? (wf < 0.75 ? (kk + kf) / K : 1 - back) : 1, idle = !active && (!running || wave === waves - 1);
                dotRect(ctx, q.x, q.y, q.w, q.h, 2.4, 0.5, idle && last < n ? C.ink2 : C.ink3, i === st.hsm ? 1 : idle ? 0.6 : 0.4);
                if (acc > 0) for (let j = 0; j < 2; j++) for (let k = 0; k < 3; k++) dot(q.x + q.w * (0.25 + 0.25 * k), q.y + q.h * (0.33 + 0.34 * j), 0.5 + 0.8 * acc, 0.35 + 0.6 * acc, C.ink);
            });
            // traffic: in the K-loop, tiles of A and B stream HBM → L2 band → SM; in the write-back, C tiles stream SM → HBM
            if (running && wave < waves) {
                const lanes = Math.min(busy, 56);
                for (let q = 0; q < lanes; q++) {
                    const sm = st.sms[Math.floor((q / lanes) * busy)], D = st.dies[sm.d], h = st.hbm.filter((hh) => hh.d === sm.d)[q % 4];
                    const hx2 = h.x + h.w / 2, hy2 = h.y + h.h / 2, mx = hx2, my = D.y + D.h / 2, sx = sm.x + sm.w / 2, sy = sm.y + sm.h / 2;
                    const path = (f) => (f < 0.5 ? [hx2 + (mx - hx2) * f * 2, hy2 + (my - hy2) * f * 2] : [mx + (sx - mx) * (f - 0.5) * 2, my + (sy - my) * (f - 0.5) * 2]);
                    if (wf < 0.75) { const f = (kf + q * 0.13) % 1, [x, y] = path(f); dot(x, y, 1, 0.8, C.ink); }
                    else if (back < 1) { const [x, y] = path(1 - smooth(back)); dot(x, y, 1.3, 0.9, C.ink); }
                }
            }
            const stage = running && wave < waves ? (wf < 0.75 ? `wave ${wave + 1}/${waves} · K-loop ${kk + 1}/${K}: load A and B tiles, multiply-accumulate` : `wave ${wave + 1}/${waves} · write-back: C tiles to HBM`) : null;
            const H2 = { corner: 'drag to resize C', matrix: 'C = A × B, C cut into tiles: one per SM per wave', sm: hot >= 0 ? `this SM owns C tile (${hj + 1}, ${hi + 1}): reads row ${hj + 1} of A, column ${hi + 1} of B` : 'idle SM in this wave', l2: 'L2 cache', hbm: 'HBM3e memory stack', link: 'die-to-die link' }[st.part];
            label(ctx, C, st, stage || H2 || 'drag C’s corner · click the chip to run', st.fx + 4, st.vy0 - 8, 'left', !!(stage || H2));
            label(ctx, C, st, `${st.mr}×${st.mc} = ${tiles} tiles ÷ ${n} SMs → ${waves} wave${waves > 1 ? 's' : ''}, last: ${last} of ${n} SMs busy`, st.fx + st.W - 10, st.vy1 + 8, 'right', true);
            label(ctx, C, st, 'A', G.A.x + (K * s2) / 2, G.A.y - 6, 'center'); label(ctx, C, st, 'B', G.B.x - 7, G.B.y + (K * s2) / 2, 'right'); label(ctx, C, st, 'C', G.C.x - 7, G.C.y + 6, 'right', true);
            if (!still && (st.run || st.press)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // The KV cache on a GPU (after PagedAttention, Kwon et al.). Right: the package as before, its HBM stacks
    // drawn as memory: part of every stack holds the model's weights, the rest holds KV pages (each page the
    // keys and values of 8 tokens), scattered across stacks the way paged allocation places them. Left: the
    // requests being served, one row of tokens each, grouped into pages. Drag the corner to set the context
    // length (across) and the batch (down); requests whose cache no longer fits wait, hollow. A click
    // generates tokens: every step reads every stored KV page from HBM into the SMs (decoding is bound by
    // memory bandwidth), then each sequence gains a token, and crossing a page boundary allocates a new page.
    F.kvcache = {
        bleed: true, COLS: 9, ROWS: 8, PAGE: 8, MAXT: 72, MAXB: 12, SLOTS: [2, 10], WEIGHTS: 6,
        title: 'KV cache', note: 'Requests’ keys and values in paged HBM; every decoding step reads the whole cache. Illustrative.',
        init(R, rand) {
            const st = F.gpu.init(R, rand), { SLOTS, WEIGHTS } = F.kvcache;
            const fx = st.fx, W = st.W, mw = W * 0.33;
            st.req = { x: fx + 4, y: st.vy0 + 8, w: mw - 10, h: st.vy1 - st.vy0 - 18 };
            st.ctx = 40; st.batch = 6; st.gen = null;
            // slots per stack (rows × cols); the first WEIGHTS hold weights; KV slot order interleaves stacks (paged)
            st.slots = []; st.hbm.forEach((h, si) => { for (let k = 0; k < SLOTS[0] * SLOTS[1]; k++) st.slots.push({ si, k, w: k < WEIGHTS }); });
            st.kvOrder = st.slots.filter((s2) => !s2.w).sort((a, b) => (a.k - b.k) || (((a.si * 7) % 8) - ((b.si * 7) % 8)));
            return st;
        },
        pages(st) { const per = Math.ceil(st.ctx / F.kvcache.PAGE), cap = st.kvOrder.length, fit = Math.min(st.batch, Math.floor(cap / Math.max(1, per))); return { per, cap, fit, used: fit * per }; },
        slotPos(st, s2) { const h = st.hbm[s2.si], [R2, C2] = F.kvcache.SLOTS, cw = h.w / C2, ch = (h.h - 4) / R2; return [h.x + (s2.k % C2 + 0.5) * cw, h.y + 2 + (Math.floor(s2.k / C2) + 0.5) * ch, cw, ch]; },
        pointer(type, x, y, st) {
            if (type === 'enter') return;
            if (type === 'leave') { st.part = null; return; }
            const q = st.req, { MAXT, MAXB } = F.kvcache, cx = q.x + (st.ctx / MAXT) * q.w, cy = q.y + (st.batch / MAXB) * q.h, near = Math.hypot(x - cx, y - cy) < 12, inReq = x < st.dies[0].x - 16;
            if (type === 'down') { st.press = { corner: near || inReq }; if (st.press.corner) st.gen = null; }
            if ((type === 'move' || type === 'down') && st.press && st.press.corner) { st.ctx = Math.max(1, Math.min(MAXT, Math.round(((x - q.x) / q.w) * MAXT))); st.batch = Math.max(1, Math.min(MAXB, Math.round(((y - q.y) / q.h) * MAXB))); st.wake = 0.4; }
            if (type === 'up' && st.press) { if (!st.press.corner) { st.gen = { start: null, steps: 6, done: 0, ctx0: st.ctx }; st.wake = 6 * 0.9 + 0.5; } st.press = null; }
            st.part = near ? 'corner' : inReq ? 'req' : st.hbm.some((h) => x > h.x && x < h.x + h.w && y > h.y - 3 && y < h.y + h.h) ? 'hbm' : st.sms.some((m) => x > m.x && x < m.x + m.w && y > m.y && y < m.y + m.h) ? 'sm' : null;
            st.wake = Math.max(st.wake || 0, 0.2);
        },
        draw(ctx, R, t, C, st, still) {
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            const { PAGE, MAXT, MAXB } = F.kvcache;
            // generation: 0.9 s per token; within a step, 0 → 0.7 read the cache, 0.7 → 1 append the new token
            let sf = 0, reading = false;
            if (st.gen && !still) {
                if (st.gen.start == null) st.gen.start = t;
                const e = (t - st.gen.start) / 0.9, k = Math.floor(e); sf = e - k;
                if (k > st.gen.done && st.gen.done < st.gen.steps) { st.gen.done = k; st.ctx = Math.min(MAXT, st.ctx + 1); }
                if (k >= st.gen.steps) st.gen = null; else reading = sf < 0.7;
            }
            const { per, cap, fit, used } = F.kvcache.pages(st), q = st.req, tw = q.w / MAXT, rh = q.h / MAXB;
            // requests: rows of tokens, a small gap between pages; rows that do not fit are hollow (waiting)
            for (let b = 0; b < st.batch; b++) for (let k = 0; k < st.ctx; k++) {
                const x = q.x + (k + 0.5) * tw + Math.floor(k / PAGE) * 0.6, y = q.y + (b + 0.5) * rh, ok = b < fit, newest = k === st.ctx - 1 && st.gen;
                if (ok) dot(x, y, newest ? 1.5 : 0.95, newest ? 1 : 0.75, C.ink); else { dot(x, y, 0.6, 0.35, C.ink3); }
            }
            dotRect(ctx, q.x - 2, q.y - 2, (st.ctx / MAXT) * q.w + 4 + Math.floor(st.ctx / PAGE) * 0.6, (st.batch / MAXB) * q.h + 4, 2.5, 0.55, C.ink2, 0.7);
            const hx = q.x + (st.ctx / MAXT) * q.w + Math.floor(st.ctx / PAGE) * 0.6, hy = q.y + (st.batch / MAXB) * q.h, hc = st.part === 'corner' || (st.press && st.press.corner);
            for (let k = 0; k < 4; k++) { dot(hx + 3, hy - k * 3, 0.8, 0.9, C.ink); dot(hx - k * 3, hy + 3, 0.8, 0.9, C.ink); }
            dot(hx + 3, hy + 3, hc ? 3.2 : 2.2, 1, C.ink);
            // the chip: dies, L2, link, NVLink pads, SMs (they flash while reading)
            st.dies.forEach((D) => { dotRect(ctx, D.x, D.y, D.w, D.h, 3, 1, C.ink2, 0.8); const by = D.y + 3 + (D.h - 6 - 7) / 2; for (let x = D.x + 5; x < D.x + D.w - 3; x += 2.5) for (let k = 0; k < 3; k++) dot(x, by + 1.2 + k * 2.2, 0.45, 0.32, C.ink3); });
            const lx0 = st.dies[0].x + st.dies[0].w, lx1 = st.dies[1].x, ly = st.dies[0].y + st.dies[0].h / 2;
            for (let k = -6; k <= 6; k++) for (let x = lx0 + 2; x <= lx1 - 2; x += 3) dot(x, ly + k * 4, 0.5, 0.35, C.ink3);
            st.sms.forEach((m, i) => { dotRect(ctx, m.x, m.y, m.w, m.h, 2.4, 0.5, C.ink3, 0.4); const a = reading ? 0.3 + 0.6 * Math.abs(Math.sin((sf * 3 + i * 0.37) * Math.PI)) : 0; if (a > 0.05) dot(m.x + m.w / 2, m.y + m.h / 2, 1.3, a, C.ink); });
            // HBM: stack outlines, weight slots (dense), KV slots filled in allocation order
            st.hbm.forEach((h) => dotRect(ctx, h.x, h.y - 1, h.w, h.h + 1, 2.6, 0.6, C.ink2, st.part === 'hbm' ? 0.95 : 0.6));
            st.slots.forEach((s2) => { const [x, y, cw, ch] = F.kvcache.slotPos(st, s2); if (s2.w) { for (let a = -1; a <= 1; a++) dot(x + a * cw * 0.25, y, 0.7, 0.55, C.ink2); } else dot(x, y, 0.5, 0.3, C.ink3); });
            for (let p = 0; p < used; p++) { const s2 = st.kvOrder[p], [x, y, cw] = F.kvcache.slotPos(st, s2); dot(x, y, Math.min(cw * 0.32, 2.2), 0.95, C.ink); }
            // traffic: every stored page streams to the SMs while reading
            if (reading) for (let p = 0; p < used; p++) {
                const s2 = st.kvOrder[p], [x, y] = F.kvcache.slotPos(st, s2), D = st.dies[st.hbm[s2.si].d], m = st.sms[(p * 29) % st.sms.length], f = (sf / 0.7 + p * 0.071) % 1;
                const mx = x, my = D.y + D.h / 2, tx = m.x + m.w / 2, ty = m.y + m.h / 2, [px, py] = f < 0.5 ? [x + (mx - x) * f * 2, y + (my - y) * f * 2] : [mx + (tx - mx) * (f - 0.5) * 2, my + (ty - my) * (f - 0.5) * 2];
                dot(px, py, 0.9, 0.75, C.ink);
            }
            // labels
            const weightsSlots = st.slots.filter((s2) => s2.w).length, full = Math.round(((weightsSlots + used) / st.slots.length) * 100);
            const H2 = { corner: 'drag: context length (across) × batch (down)', req: 'requests: one row of tokens each, 8 tokens to a KV page', hbm: 'HBM: model weights (dense) + KV pages, allocated wherever free', sm: 'SMs: each new token attends over every cached key and value' }[st.part];
            const stage = st.gen ? (reading ? `token ${st.gen.done + 1}/${st.gen.steps}: reading all ${used} KV pages from HBM` : `token ${st.gen.done + 1}/${st.gen.steps}: appending K and V${st.ctx % PAGE === 0 ? ' — new page' : ''}`) : null;
            label(ctx, C, st, stage || H2 || 'drag the corner · click the chip to generate', st.fx + 4, st.vy0 - 8, 'left', !!(stage || H2));
            label(ctx, C, st, `${st.batch} request${st.batch > 1 ? 's' : ''} × ${st.ctx} tokens → ${used} pages · HBM ${full}% full${fit < st.batch ? ` · ${st.batch - fit} waiting` : ''}`, st.fx + st.W - 10, st.vy1 + 8, 'right', true);
            label(ctx, C, st, 'illustrative', st.fx + st.W - 10, st.vy0 - 8, 'right');
            if (!still && (st.gen || st.press)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // The Blackwell Ultra GPU, after NVIDIA's floorplan: two dies joined by NV-HBI (10 TB/s die to die), each with four
    // graphics processing clusters (GPCs) in two rows around an L2 cache, HBM controllers along top and bottom, the
    // GigaThread engine across the middle; NVLink and PCIe Gen 6 on the left edge, NVLink-C2C on the right. Every
    // component opens up as you zoom, one level at a time: a click frames it, another goes a level deeper (HBM: the die
    // stack, a die's bank groups, a bank's cell array; L2: slices, SRAM cells; the GigaThread engine's queue; the links'
    // lanes; NVDEC's stages; a GPC: TPCs, an SM's quadrants, a tensor core's multiply-accumulate grid, then logic cells,
    // FinFETs from above, the silicon crystal, an atom as a quantum electron density, one bond orbital's wavefunction, its
    // nucleus as a density). Hover a block for its wiring. Drag up to zoom towards where you pressed, down to zoom out; a
    // double click flies back to the whole chip.
    F.chip = {
        bleed: true, ZMAX: 3e9,
        title: 'GPU floorplan', note: 'Blackwell Ultra after NVIDIA’s floorplan; every component opens up as you zoom, down to the quantum electron density of a silicon atom.',
        // chip units: 100 × 64. Blocks: [kind, x, y, w, h, die]
        layout() {
            const B = [];
            B.push(['pcie', 1, 2, 4, 8, 0], ['nvlink', 1, 11, 4, 51, 0], ['c2c', 95, 11, 4, 44, 1], ['hbi', 48.6, 1, 2.8, 62, -1]);
            [6, 52].forEach((dx, d) => {
                B.push(['hbm', dx + 1.5, 1.5, 17, 4.5, d], ['hbm', dx + 22, 1.5, 17, 4.5, d], ['hbm', dx + 1.5, 58, 17, 4.5, d], ['hbm', dx + 22, 58, 17, 4.5, d]);
                B.push(['gpc', dx + 0.8, 7, 15.5, 23.5, d], ['l2', dx + 16.8, 7, 7.2, 23.5, d], ['gpc', dx + 24.5, 7, 15.5, 23.5, d]);
                B.push(['giga', dx + 0.8, 31.2, 36.5, 4.6, d], ['nvdec', dx + (d ? 0.8 : 37.8), 31.2, 2.4, 4.6, d]);
                B.push(['gpc', dx + 0.8, 36.6, 15.5, 20.6, d], ['l2', dx + 16.8, 36.6, 7.2, 20.6, d], ['gpc', dx + 24.5, 36.6, 15.5, 20.6, d]);
            });
            // the giga band leaves room for NVDEC on the inner edge
            return B.map(([kind, x, y, w, h, d], i) => ({ i, kind, x: kind === 'giga' && d === 1 ? x + 3 : x, y, w: kind === 'giga' ? w - 3 + 3 * 0 : w, h, d }));
        },
        NAMES: {
            gpc: 'GPC · 10 TPCs × 2 SMs', l2: 'L2 cache', hbm: 'HBM3E · 8 stacks, 288 GB, 8 TB/s', giga: 'GigaThread · work distribution', nvdec: 'NVDEC · video decode',
            hbi: 'NV-HBI · 10 TB/s die to die', nvlink: 'NVLink 5 · 1.8 TB/s', c2c: 'NVLink-C2C · 900 GB/s to Grace', pcie: 'PCIe Gen 6 ×16 · 256 GB/s',
        },
        // each component's levels (shown as its frame grows on screen: a level per threshold in screen pixels)
        DEPTH: {
            hbm: [[140, 'HBM3E · 12-high DRAM stack, TSVs'], [1400, 'DRAM die · bank groups'], [7000, 'DRAM bank · 1T1C cells, sense amps']],
            l2: [[60, 'L2 · slices'], [400, 'SRAM · 6T cells']],
            giga: [[100, 'GigaThread · block queue']],
            hbi: [[40, 'NV-HBI · die-to-die wires']],
            nvlink: [[40, 'NVLink 5 · 18 links']],
            pcie: [[40, 'PCIe Gen 6 · 16 lanes']],
            c2c: [[40, 'NVLink-C2C · lanes']],
            nvdec: [[40, 'NVDEC · entropy, transform, motion, deblock']],
        },
        init(R) {
            // at rest the whole chip fits the visible columns; zoomed in, it spills left into the fade column and up
            // and down, where the page's masks dissolve it instead of a hard frame cutting it off
            const fx = R.fx ?? R.x, vy0 = (R.vy0 ?? R.y) - 6, vy1 = (R.vy1 ?? R.y + R.h) + 4, W = R.x + R.w - fx - 8;
            const view = { x: fx + 4, y: vy0, w: W, h: vy1 - vy0 }, s0 = Math.min(view.w / 100, view.h / 64);
            return { fx, vy0, vy1, W, view, s0, z: 1, cx: 50, cy: 32, blocks: F.chip.layout(), hb: -1, fly: null };
        },
        // how far a component other than a GPC lets you zoom: until its last level is well in view
        zmax(st, b) { const L = F.chip.DEPTH[b.kind]; return L ? Math.max(2, (L[L.length - 1][0] * 4) / (Math.min(b.w, b.h * 4) * st.s0)) : F.chip.ZMAX; },
        // chip coordinates ↔ screen: the view centre shows (cx, cy) at scale s0·z
        toS(st, x, y) { const v = st.view, s2 = st.s0 * st.z; return [v.x + v.w / 2 + (x - st.cx) * s2, v.y + v.h / 2 + (y - st.cy) * s2]; },
        toC(st, X, Y) { const v = st.view, s2 = st.s0 * st.z; return [st.cx + (X - v.x - v.w / 2) / s2, st.cy + (Y - v.y - v.h / 2) / s2]; },
        at(st, x, y) { return st.blocks.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); },
        // below the crystal: positions in chip units, relative to the chosen atom. The lattice: atoms a2 apart in rows
        // b2 apart, odd rows shifted half a spacing
        deep(st) { const mac = st.mac || 0.035, a2 = mac / 2500, R0 = 12 / (5e7 * st.s0); return { a2, b2: a2 * 1.41, R0, rn: R0 * 0.2 }; },
        // each single-object stage (MAC unit, cell, FinFET, crystal) sits where it was clicked into, so a click grows the next
        // stage out of the part clicked while the current one stays put; a stage not clicked into sits where the one above it does
        STAGES: ['mac', 'cell', 'fet', 'xtal'], CUT: [850, 2600, 10000, 60000],
        anchor(st, k) { for (let j = k; j >= 0; j--) { const a = st.at && st.at[F.chip.STAGES[j]]; if (a) return a; } return st.tgt; },
        stageAt(z) { let k = 0; F.chip.CUT.forEach((c, j) => { if (z >= c) k = j; }); return k; },
        atomNear(st, x, y) { const { a2, b2 } = F.chip.deep(st), [tx, ty] = F.chip.anchor(st, 3); let best = null, bd = Infinity; const j0 = Math.round((y - ty) / b2); for (let j = j0 - 1; j <= j0 + 1; j++) { const off = (j % 2) * a2 * 0.5, i2 = Math.round((x - tx - off) / a2); for (let i = i2 - 1; i <= i2 + 1; i++) { const ax = tx + i * a2 + off, ay = ty + j * b2, d = Math.hypot(ax - x, ay - y); if (d < bd) { bd = d; best = [ax, ay]; } } } return best; },
        // the deep object the view settles on at this zoom: the chosen atom
        focus(st, z = st.z) { return z >= 1.2e6 && st.anc ? st.anc : z >= 1500 && st.tgt ? F.chip.anchor(st, F.chip.stageAt(z)) : null; },
        // pick what a point is nearest to, at the depth the zoom is heading for
        pick(st, x, y, z) {
            if (z >= 1.2e6 && (!st.anc || st.z < 5e6)) { st.anc = F.chip.atomNear(st, x, y); return; }   // while the crystal shows, a click picks another atom
        },
        // where a zoom should land: the tensor core of an SM in the GPC nearest the press (same geometry as draw)
        target(st, px, py) {
            const g = st.blocks.filter((b) => b.kind === 'gpc').sort((a, b) => Math.hypot(a.x + a.w / 2 - px, a.y + a.h / 2 - py) - Math.hypot(b.x + b.w / 2 - px, b.y + b.h / 2 - py))[0];
            const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), tw = (g.w - 1.2) / 2, th = (g.h - 1.2) / 5;
            const ci = cl(Math.floor((px - g.x - 0.6) / tw), 0, 1), ri = cl(Math.floor((py - g.y - 0.6) / th), 0, 4), tx = g.x + 0.6 + ci * tw, ty = g.y + 0.6 + ri * th;
            const sw = (tw - 0.8) / 2 - 0.2, sh = th - 0.8, sm = cl(Math.floor((px - tx - 0.4) / ((tw - 0.8) / 2)), 0, 1), sx = tx + 0.4 + sm * ((tw - 0.8) / 2), sy = ty + 0.4;
            const l1h = sh * 0.16, qw = sw / 2, qh = (sh - l1h) / 2, qc = cl(Math.floor((px - sx) / qw), 0, 1), qr = cl(Math.floor((py - sy) / qh), 0, 1);   // the SM and quadrant nearest the point
            const qx = sx + qc * qw, qy = sy + qr * qh, tcx = qx + qw * 0.54, tcy = qy + qh * 0.42, tcw = qw * 0.38, tch = qh * 0.5;
            st.mac = tcw / 16; st.macH = tch / 12; return [tcx + (7.5 / 16) * tcw, tcy + (5.5 / 12) * tch];   // a MAC cell's centre: the zoom keeps going into it
        },
        pointer(type, x, y, st, R, buttons) {
            if (type === 'enter') return;
            if (type === 'leave') { st.hoverAt = null; st.mouse = null; st.hb = -1; return; }
            const [px, py] = F.chip.toC(st, x, y);
            if (type === 'wheel') {                                                                               // a pinch (or ctrl + wheel): zoom about the pointer
                const z1 = Math.max(1, Math.min(F.chip.ZMAX, st.z * Math.exp(-buttons * 0.01))), v = st.view, s3 = st.s0 * z1; st.fly = null;
                if (z1 > 45 && st.z <= 300 && z1 > st.z) { st.tgt = F.chip.target(st, px, py); st.at = {}; }                     // into the cores: towards the MAC under the pointer
                if (z1 < 1e6) st.anc = null; st.z = z1;
                if (z1 <= 1.001) { st.cx = 50; st.cy = 32; } else if (z1 < 1500) { const k = z1 > 300 && st.tgt ? Math.min(1, Math.log(z1 / 300) / Math.log(2)) : 0; st.cx = px - (x - v.x - v.w / 2) / s3; st.cy = py - (y - v.y - v.h / 2) / s3; if (k) { st.cx += (st.tgt[0] - st.cx) * k; st.cy += (st.tgt[1] - st.cy) * k; } }   // past the cores the view eases onto the target, held there deeper
                st.wake = 0.6; return;
            }
            const own = st.blocks[F.chip.at(st, px, py)], other = own && own.kind !== 'gpc' && st.z < 300 ? own : null;
            if (type === 'down') { const tg = other ? [px, py] : st.z > 300 && st.tgt ? st.tgt : F.chip.target(st, px, py);   /* the tensor core nearest the press */ st.press = { x, y, z: st.z, fx: px, fy: py, moved: false, tgt: tg, t: performance.now(), free: st.z > 300 }; st.tgt = tg; st.fly = null; return; }
            if (type === 'move' && st.press) {
                if (Math.hypot(x - st.press.x, y - st.press.y) > 4) st.press.moved = true; st.press.lx = x; st.press.ly = y;
                if (st.press.moved) {
                    // drag up: zoom in, keeping the pressed point under the pointer's start
                    const pressed = st.blocks[F.chip.at(st, st.press.fx, st.press.fy)], cap = pressed && pressed.kind !== 'gpc' ? F.chip.zmax(st, pressed) : F.chip.ZMAX;
                    const z = Math.max(1, Math.min(cap, st.press.z * Math.exp(-(y - st.press.y) * 0.042)));
                    st.z = z; const v = st.view, s2 = st.s0 * z;
                    const ax = st.press.fx - (st.press.x - v.x - v.w / 2) / s2, ay = st.press.fy - (st.press.y - v.y - v.h / 2) / s2;
                    // steer: from keeping the pressed point put, towards centring the target tensor core, as the zoom deepens
                    const w = Math.max(0, Math.min(1, Math.log(z / 1.3) / Math.log(30))), e = w * w * (3 - 2 * w);   // locked onto the target by ~40×
                    if (z > 300 && !st.press.free) { st.press.free = true; st.press.z = st.z; st.press.y = y; st.press.x = x; [st.press.fx, st.press.fy] = F.chip.toC(st, x, y); }   // past the cells: free
                    if (st.press.free) { const zf = Math.max(300, z); if (zf !== z) { st.press.free = false; } st.z = zf; const s3 = st.s0 * zf; st.cx = st.press.fx - (st.press.x - v.x - v.w / 2) / s3; st.cy = st.press.fy - (st.press.y - v.y - v.h / 2) / s3; if (zf >= 1.2e6 && !st.anc) F.chip.pick(st, st.cx, st.cy, zf); if (zf < 1e6) st.anc = null; st.wake = 0.4; return; }
                    st.cx = e >= 1 ? st.press.tgt[0] : ax + (st.press.tgt[0] - ax) * e; st.cy = e >= 1 ? st.press.tgt[1] : ay + (st.press.tgt[1] - ay) * e;
                    if (z <= 1.001) { st.cx = 50; st.cy = 32; }
                    st.wake = 0.4;
                }
                return;
            }
            if (type === 'up' && st.press) {
                const moved = st.press.moved, pr = st.press; st.press = null; if (moved) return;
                const now = performance.now(), dbl = st.lastClick && now - st.lastClick < 320 && Math.hypot(x - st.lastXY[0], y - st.lastXY[1]) < 14; st.lastClick = dbl ? 0 : now; st.lastXY = [x, y];
                const flyTo = (z1, cx1, cy1) => { st.fly = { start: null, z0: st.z, cx0: st.cx, cy0: st.cy, z1, cx1, cy1 }; st.wake = 1.4; };
                if (dbl) { st.anc = null; st.at = {}; flyTo(1, 50, 32); return; }                                                // double click: home
                const ho = st.hitObj;
                if (ho && !ho.deeper) { st.flash = { box: ho.box, t: performance.now() }; st.wake = 1; return; }   // nothing below it: it says so, the view stays
                if (!ho && !st.fly && st.z > 1.05) { const stops = [1, 3, 15, 60, 250, 1500, 5000, 14000, 4e5, 3e7, 1.5e9], z1 = stops.filter((q) => q < st.z / 1.2).pop() || 1; if (z1 < 1.2e6) st.anc = null; if (z1 < 6500) st.mat = null; flyTo(z1, z1 <= 1 ? 50 : st.cx, z1 <= 1 ? 32 : st.cy); return; }   // empty space: a level out
                if (ho && ho.anc) { st.anc = ho.anc; flyTo(Math.max(ho.goZ, st.z * 1.5), ho.anc[0], ho.anc[1]); return; }   // an atom
                if (ho && ho.goZ === 5000) st.cell = /^multiplier/.test(ho.name) ? 'and' : /^accumulator/.test(ho.name) ? 'ff' : 'fa';   // the cell below shows that part's circuit
                if (ho && ho.goZ === 14000) st.fet = /^pFET/.test(ho.name) ? 'p' : 'n';   // the FinFET below is that device
                if (ho && ho.goZ === 4e5) st.mat = /^(source|drain)/.test(ho.name) ? 'doped' : /^gate/.test(ho.name) ? 'gate' : 'si';   // the crystal below shows what that part is made of
                if (ho && ho.goZ && ho.goZ > st.z * 1.2) { const [cx1, cy1] = F.chip.toC(st, (ho.box[0] + ho.box[2]) / 2, (ho.box[1] + ho.box[3]) / 2); if (st.z < 300) { F.chip.target(st, cx1, cy1); st.tgt = [cx1, cy1]; st.at = {}; } else if (st.z < 1.2e6) { const k = F.chip.stageAt(ho.goZ); st.at = Object.fromEntries(Object.entries(st.at || {}).filter(([q]) => F.chip.STAGES.indexOf(q) < k)); st.at[F.chip.STAGES[k]] = [cx1, cy1]; } if (st.z < 1.2e6) { flyTo(ho.goZ, cx1, cy1); } else flyTo(ho.goZ, st.cx, st.cy); return; }   // the next stage grows out of the part clicked, ending centred on it
                if (ho && st.z < 300) { const bw = ho.box[2] - ho.box[0], bh2 = ho.box[3] - ho.box[1], k = Math.min(st.view.w / bw, st.view.h / bh2) * 0.8;   // frame the hovered part
                    if (k > 1.3) { const [cx1, cy1] = F.chip.toC(st, (ho.box[0] + ho.box[2]) / 2, (ho.box[1] + ho.box[3]) / 2), own2 = st.blocks[F.chip.at(st, cx1, cy1)]; const z1 = Math.min(own2 && own2.kind !== 'gpc' ? F.chip.zmax(st, own2) : F.chip.ZMAX, st.z * k); st.tgt = own2 && own2.kind === 'gpc' ? F.chip.target(st, cx1, cy1) : st.tgt; flyTo(z1, cx1, cy1); return; } }
                // a component whose framing would bring us closer: frame it; otherwise go six times deeper
                const b = st.blocks[F.chip.at(st, pr.fx, pr.fy)], thin = b && b.h > 4 * b.w, zb = b ? Math.max(1.2, thin ? (st.view.w * 0.25) / (b.w * st.s0) : Math.min(st.view.w / (b.w * st.s0), st.view.h / (b.h * st.s0)) * 0.9) : 0;
                if (b && zb > st.z * 1.3) { const z1 = zb, fy1 = thin ? Math.max(b.y, Math.min(b.y + b.h, pr.fy)) : b.y + b.h / 2; st.tgt = F.chip.target(st, b.x + b.w / 2, fy1); flyTo(z1, b.x + b.w / 2, fy1); }   // a component: frame it (a thin one around the click)
                else if (b && b.kind !== 'gpc' && st.z < 300) { const z1 = Math.min(F.chip.zmax(st, b), st.z * 6); if (z1 > st.z * 1.05) flyTo(z1, pr.fx, pr.fy); }   // inside it: a level deeper, where it was clicked
                else { st.tgt = st.tgt || F.chip.target(st, pr.fx, pr.fy); const z1 = Math.min(F.chip.ZMAX, st.z * 6); if (st.z > 300) { F.chip.pick(st, pr.fx, pr.fy, z1); const f = F.chip.focus(st, z1); flyTo(z1, f ? f[0] : pr.fx, f ? f[1] : pr.fy); } else if (z1 > 30) { st.tgt = F.chip.target(st, pr.fx, pr.fy); flyTo(z1, st.tgt[0], st.tgt[1]); } else flyTo(z1, pr.fx, pr.fy); }   /* from the SM down, onto the tensor core nearest the click (gaps hold nothing) */   /* below the cells: to the atom, nucleon or quark nearest the click */      // deeper: six times closer, towards the click
                return;
            }
            st.hoverAt = [px, py]; st.mouse = [x, y]; st.hb = F.chip.at(st, px, py); st.wake = Math.max(st.wake || 0, 1.5);
        },
        // wiring for a hovered block at chip level: polylines in chip coordinates
        wires(st, b) {
            const B = st.blocks, mid = (q) => [q.x + q.w / 2, q.y + q.h / 2], same = (k) => B.filter((q) => q.kind === k && q.d === b.d), other = (k) => B.filter((q) => q.kind === k && q.d !== b.d && q.d >= 0);
            const route = (a, c) => [a, [a[0], c[1]], c];                                         // Manhattan: vertical then horizontal
            const W2 = [];
            if (b.kind === 'gpc') { const l2 = same('l2').sort((p, q) => Math.abs(mid(p)[1] - mid(b)[1]) - Math.abs(mid(q)[1] - mid(b)[1]))[0]; W2.push([mid(b), [mid(l2)[0], mid(b)[1]]]); same('hbm').forEach((h) => W2.push(route(mid(l2), mid(h)))); const hbi = B.find((q) => q.kind === 'hbi'); W2.push([mid(l2), [mid(hbi)[0], mid(l2)[1]]]); other('l2').forEach((q) => W2.push([[mid(hbi)[0], mid(l2)[1]], [mid(hbi)[0], mid(q)[1]], mid(q)])); }
            if (b.kind === 'l2') { same('gpc').forEach((g) => W2.push([mid(b), [mid(b)[0], mid(g)[1]], mid(g)])); same('hbm').forEach((h) => W2.push(route(mid(b), mid(h)))); }
            if (b.kind === 'hbm') { same('l2').forEach((l) => W2.push(route(mid(b), mid(l)))); W2.push([mid(b), [mid(b)[0], b.y < 30 ? -4 : 68]]); }
            if (b.kind === 'giga') same('gpc').forEach((g) => W2.push([mid(b), [mid(g)[0], mid(b)[1]], mid(g)]));
            if (b.kind === 'hbi') [...B.filter((q) => q.kind === 'l2')].forEach((l) => W2.push([mid(l), [mid(b)[0], mid(l)[1]]]));
            if (b.kind === 'nvlink' || b.kind === 'pcie' || b.kind === 'c2c') { const ls = B.filter((q) => q.kind === 'l2' && q.d === (b.kind === 'c2c' ? 1 : 0)); ls.forEach((l) => W2.push([mid(b), [mid(b)[0], mid(l)[1]], mid(l)])); const g = B.find((q) => q.kind === 'giga' && q.d === (b.kind === 'c2c' ? 1 : 0)); W2.push([mid(b), [mid(b)[0], mid(g)[1]], mid(g)]); W2.push([mid(b), [b.kind === 'c2c' ? 104 : -4, mid(b)[1]]]); }
            return W2;
        },
        draw(ctx, R, t, C, st, still) {
            // small dots as squares (much cheaper, identical at this size); larger ones as discs
            const dot = (x, y, r2, a, col) => { r2 = r2 < 0.9 ? 0.6 : r2 < 1.8 ? 1.2 : 2.4; col = C.ink; ctx.globalAlpha = a; ctx.fillStyle = col;   /* sizes snap to u·2^k */ if (r2 < 1.4) { ctx.fillRect(x - r2, y - r2, 2 * r2, 2 * r2); return; } ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            if (st.fly && !still) { if (st.fly.start == null) st.fly.start = t; const e = smooth(Math.min(1, (t - st.fly.start) / 1.1)), f = st.fly; st.z = Math.exp(Math.log(f.z0) * (1 - e) + Math.log(f.z1) * e); st.cx = f.cx0 + (f.cx1 - f.cx0) * e; st.cy = f.cy0 + (f.cy1 - f.cy0) * e; if (e >= 1) st.fly = null; }
            if (!still && !st.fly) { if (st.z >= 1.2e6 && !st.anc) F.chip.pick(st, st.cx, st.cy, st.z); const f = F.chip.focus(st); if (f) { const k = st.press ? 0.12 : 0.2; st.cx += (f[0] - st.cx) * k; st.cy += (f[1] - st.cy) * k; if (Math.hypot(f[0] - st.cx, f[1] - st.cy) * st.s0 * st.z > 0.3) st.wake = Math.max(st.wake || 0, 0.3); if (st.press && st.press.free && st.press.ly != null) { st.press.x = st.press.lx; st.press.y = st.press.ly; [st.press.fx, st.press.fy] = F.chip.toC(st, st.press.x, st.press.y); st.press.z = st.z; }   /* re-anchor the drag where the pointer is now */ } }
            const v = st.view, z = st.z, S = (x, y) => F.chip.toS(st, x, y), s2 = st.s0 * z;
            ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, v.y + v.h + 2 - R.y); ctx.clip();   // the chip stops above the sliders
            const vis = (x, y, w, h) => { const [a, b] = S(x, y), [c, d] = S(x + w, y + h); return c > R.x - 10 && a < R.x + R.w + 10 && d > R.y - 10 && b < R.y + R.h + 10; };
            const VX0 = R.x - 4, VX1 = R.x + R.w + 4, VY0 = R.y - 4, VY1 = v.y + v.h + 4;
            const edge = (x0, y0, x1, y1, step, size, a, col) => {                               // one edge, trimmed to the visible area
                if (y0 === y1) { if (y0 < VY0 || y0 > VY1) return; const a0 = Math.max(Math.min(x0, x1), VX0), a1 = Math.min(Math.max(x0, x1), VX1); for (let x = a0 - ((a0 - Math.min(x0, x1)) % step); x <= a1; x += step) dot(x, y0, size, a, col); }
                else { if (x0 < VX0 || x0 > VX1) return; const a0 = Math.max(Math.min(y0, y1), VY0), a1 = Math.min(Math.max(y0, y1), VY1); for (let y = a0 - ((a0 - Math.min(y0, y1)) % step); y <= a1; y += step) dot(x0, y, size, a, col); }
            };
            const rectD = (x, y, w, h, a, col, step = 2.6, size = 0.6) => { const [X, Y] = S(x, y), W2 = w * s2, H2 = h * s2; if (X > VX1 || Y > VY1 || X + W2 < VX0 || Y + H2 < VY0) return; ctx.globalAlpha = a; ctx.strokeStyle = C.ink; ctx.lineWidth = size >= 1 ? K.U : K.U / 2; ctx.setLineDash([]); ctx.strokeRect(X, Y, W2, H2); void step; void edge; };   // outlines as thin solid lines
            const stipple = (x, y, w, h, gap, a, col, size = 0.55) => { gap = gap < 3.6 ? 2 * K.U : 4 * K.U; size = 0.6;   /* a field: context points, 2u or 4u apart */ const [X, Y] = S(x, y), W2 = w * s2, H2 = h * s2; const x0 = Math.max(X, VX0), x1 = Math.min(X + W2, VX1), y0 = Math.max(Y, VY0), y1 = Math.min(Y + H2, VY1); if (x1 <= x0 || y1 <= y0) return; const nn = ((x1 - x0) * (y1 - y0)) / (gap * gap); if (nn > 2500) gap *= Math.sqrt(nn / 2500); /* cap the dots per fill */ for (let yy = y0 + ((Y - y0) % gap + gap) % gap; yy < y1; yy += gap) for (let xx = x0 + ((X - x0) % gap + gap) % gap; xx < x1; xx += gap) dot(xx, yy, size, a, col); };
            // compute: a grid of outlined cells (memory is a field of points, control a line)
            const cells = (x, y, w, h, nx, ny, a) => { const [X, Y] = S(x, y), cw = (w * s2) / nx, ch = (h * s2) / ny; if (X > VX1 || Y > VY1 || X + w * s2 < VX0 || Y + h * s2 < VY0 || cw < 3 || ch < 3) return; ctx.globalAlpha = a; ctx.strokeStyle = C.ink; ctx.lineWidth = K.U / 2; ctx.setLineDash([]); const g = Math.min(cw, ch) * 0.18; for (let q = 0; q < ny; q++) for (let p2 = 0; p2 < nx; p2++) { const cx = X + p2 * cw, cy = Y + q * ch; if (cx > VX1 || cy > VY1 || cx + cw < VX0 || cy + ch < VY0) continue; ctx.strokeRect(cx + g / 2, cy + g / 2, cw - g, ch - g); } };
            const ctrl = (x, y, w, a) => { const [X, Y] = S(x, y); ctx.globalAlpha = a; ctx.strokeStyle = C.ink; ctx.lineWidth = K.U; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(Math.max(VX0, X), Y); ctx.lineTo(Math.min(VX1, X + w * s2), Y); ctx.stroke(); };
            const fadeIn = (lo, hi) => Math.max(0, Math.min(1, (Math.log(z) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))));
            // what can be hovered: each component drawn this frame registers its box on screen and a name
            const hits = [], regS = (X0, Y0, X1, Y1, name, deeper = true, goZ = 0, anc = null) => { if (X1 - X0 < 5 || Y1 - Y0 < 5 || X1 < VX0 || X0 > VX1 || Y1 < VY0 || Y0 > VY1) return; if (z > 300 && deeper && X0 <= v.x && X1 >= v.x + v.w && Y0 <= v.y && Y1 >= v.y + v.h) return;   /* a part the view is inside: not a target (a click there goes out) */ hits.push([X0, Y0, X1, Y1, name, deeper, goZ, anc]); };
            const reg = (x, y, w, h, name, deeper = true, goZ = 0) => { const [X0, Y0] = S(x, y), [X1, Y1] = S(x + w, y + h); regS(X0, Y0, X1, Y1, name, deeper, goZ); };
            const prog = 1, gpcs = st.blocks.filter((q) => q.kind === 'gpc'), smOn = () => true;   // every SM at work (its tensor core's array runs)
            const mid = (q) => [q.x + q.w / 2, q.y + q.h / 2], lerpPath = (path, f) => { const L = path.slice(1).map((q, k) => Math.hypot(q[0] - path[k][0], q[1] - path[k][1])), tot = L.reduce((x2, y2) => x2 + y2, 0); let d = f * tot; for (let k = 0; k < L.length; k++) { if (d <= L[k]) { const g = d / (L[k] || 1); return [path[k][0] + (path[k + 1][0] - path[k][0]) * g, path[k][1] + (path[k + 1][1] - path[k][1]) * g]; } d -= L[k]; } return path[path.length - 1]; };
            // an array at a fixed pitch on screen within a rectangle, only its visible part: lines across and down, a point at
            // each crossing (memory); a deep level keeps a full array in view however far in
            const array = (x, y, w, h, pitch, a, pulse) => {
                const pc = pitch / s2, [X0, Y0] = S(x, y), [X1, Y1] = S(x + w, y + h), xa = Math.max(X0, VX0), xb = Math.min(X1, VX1), ya = Math.max(Y0, VY0), yb = Math.min(Y1, VY1);
                if (xb <= xa || yb <= ya) return; const i0 = Math.ceil((xa - X0) / pitch), i1 = Math.floor((xb - X0) / pitch), j0 = Math.ceil((ya - Y0) / pitch), j1 = Math.floor((yb - Y0) / pitch);
                ctx.globalAlpha = 0.25 * a; ctx.strokeStyle = C.ink; ctx.lineWidth = K.U / 2; ctx.beginPath();
                for (let i = i0; i <= i1; i++) { const X = X0 + i * pitch; ctx.moveTo(X, ya); ctx.lineTo(X, yb); }
                for (let j = j0; j <= j1; j++) { const Y = Y0 + j * pitch; ctx.moveTo(xa, Y); ctx.lineTo(xb, Y); } ctx.stroke();
                for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) { if (j % 17 === 16 || i % 33 === 32) continue; dot(X0 + (i + 0.5) * pitch, Y0 + (j + 0.5) * pitch, 1.2, (pulse && (i * 7 + j * 3 + Math.floor(t * 6)) % 23 === 0 ? 1 : 0.5) * a, C.ink); }
                ctx.globalAlpha = 0.5 * a; ctx.lineWidth = K.U / 2;                                                    // its repeating units: sense amplifiers (cells) every 16 rows, a decoder (a line) every 32 columns
                for (let j = j0; j < j1; j++) if (j % 17 === 16) { const Y = Y0 + j * pitch; for (let X = xa - ((xa - X0) % (pitch * 2)); X < xb; X += pitch * 2) ctx.strokeRect(X + 1, Y + 2, pitch * 2 - 2, pitch - 4); }
                ctx.lineWidth = K.U; ctx.beginPath(); for (let i = i0; i < i1; i++) if (i % 33 === 32) { const X = X0 + (i + 0.5) * pitch; ctx.moveTo(X, ya); ctx.lineTo(X, yb); } ctx.stroke();
                void pc;
            };
            // a component's levels: each drawn inside its frame once the frame is large enough on screen, the one before fading
            const lvl0 = (b2, k) => { const th = (F.chip.DEPTH[b2.kind] || [])[k]; if (!th) return 0; const px = Math.min(b2.w, b2.h * 4) * s2; return Math.max(0, Math.min(1, (px - th[0]) / th[0])); };
            const lvl = (b2, k) => { const L = F.chip.DEPTH[b2.kind] || []; let cur = -1; L.forEach((_, q) => { if (lvl0(b2, q) > 0) cur = q; }); return k === cur ? Math.min(1, lvl0(b2, k) * 2) : 0; };   // only the deepest level shown
            const interior = (b2) => {
                const { x, y, w, h } = b2, l0 = lvl(b2, 0), l1 = lvl(b2, 1), l2 = lvl(b2, 2), on = true, open = l0 + l1 + l2;   // a gentle traffic everywhere
                if (b2.kind === 'hbm') {
                    const a0 = l0, a1 = l1;
                    if (a0 > 0) { const n = 12, bh = h * 0.18, sh = (h - bh - h * 0.1) / n;                     // the stack from the side
                        for (let q = 0; q < n; q++) { reg(x + w * 0.04, y + h * 0.05 + q * sh, w * 0.92, sh * 0.8, `DRAM die ${q + 1} of 12`); rectD(x + w * 0.04, y + h * 0.05 + q * sh, w * 0.92, sh * 0.8, 0.5 * a0, C.ink2); stipple(x + w * 0.05, y + h * 0.05 + q * sh + sh * 0.15, w * 0.9, sh * 0.5, 2, 0.25 * a0, C.ink3); }
                        cells(x + w * 0.04, y + h - bh - h * 0.04, w * 0.92, bh, 24, 1, 0.5 * a0); reg(x + w * 0.04, y + h - bh - h * 0.04, w * 0.92, bh, 'base logic die', false);
                        for (let q = 1; q < 8; q++) { const xx = x + w * (0.04 + 0.92 * q / 8), [X, Y0] = S(xx, y + h * 0.05), [, Y1] = S(xx, y + h - h * 0.04); for (let yy = Y0; yy < Y1; yy += 2 * K.U) dot(X, yy, 0.6, a0, C.ink); if (on) { const u = (t * 0.8 + q * 0.13) % 1; dot(X, Y1 - u * (Y1 - Y0), 1.2, a0, C.ink); } } }
                    if (a1 > 0) { const gx = 4, gy = 4, cw2 = w / gx, ch2 = h / gy;                                // a die: bank groups
                        for (let i = 0; i < gx; i++) for (let j = 0; j < gy; j++) { const bx = x + i * cw2, by = y + j * ch2; reg(bx + cw2 * 0.06, by + ch2 * 0.08, cw2 * 0.88, ch2 * 0.84, 'bank group · 4 banks'); rectD(bx + cw2 * 0.06, by + ch2 * 0.08, cw2 * 0.88, ch2 * 0.84, 0.5 * a1, C.ink2); stipple(bx + cw2 * 0.1, by + ch2 * 0.14, cw2 * 0.8, ch2 * 0.58, 2, 0.25 * a1, C.ink3); ctrl(bx + cw2 * 0.1, by + ch2 * 0.8, cw2 * 0.8, 0.5 * a1); } }
                    if (l2 > 0) { reg(x, y, w, h * 0.86, 'cell array · 1T1C, 1 bit each', false); reg(x, y + h * 0.86, w, h * 0.12, 'sense amplifiers · one per bit line', false); array(x, y, w, h * 0.86, 12, l2, on); const [, SY] = S(x, y + h * 0.86); if (SY < VY1) cells(x, y + h * 0.86, w, h * 0.12, Math.max(4, Math.round((w * s2) / 24)), 1, 0.5 * l2); }   // a bank: the cell array, sense amplifiers below
                    return 1 - open;
                }
                if (b2.kind === 'l2') {
                    const a0 = l0;
                    if (a0 > 0) for (let i = 0; i < 2; i++) for (let j = 0; j < 8; j++) { const sx = x + w * (0.06 + i * 0.46), sy = y + h * (0.02 + j * 0.12), sw2 = w * 0.42, sh2 = h * 0.11; reg(sx, sy, sw2, sh2, 'L2 slice · tags + SRAM'); rectD(sx, sy, sw2, sh2, 0.5 * a0, C.ink2); ctrl(sx + sw2 * 0.08, sy + sh2 * 0.15, sw2 * 0.84, 0.5 * a0); stipple(sx + sw2 * 0.08, sy + sh2 * 0.3, sw2 * 0.84, sh2 * 0.6, 2, (on && (i + j + Math.floor(t * 4)) % 5 === 0 ? 0.5 : 0.25) * a0, C.ink3); }
                    if (l1 > 0) { reg(x, y, w, h, 'SRAM · 6T cells', false); array(x, y, w, h, 12, l1, on); }               // SRAM: bit cells at the crossings
                    return 1 - open;
                }
                if (b2.kind === 'giga' && l0 > 0) {                                                                     // the queue, and blocks handed out
                    reg(x, y, w, h, 'GigaThread · block queue', false); const nq = 18, qw = (w * 0.5) / nq; for (let q = 0; q < nq; q++) { const filled = on ? q < nq * (1 - prog) : q < 4; rectD(x + w * 0.02 + q * qw, y + h * 0.3, qw * 0.8, h * 0.4, (filled ? 1 : 0.25) * l0, C.ink); }
                    gpcs.filter((g) => g.d === b2.d).forEach((g, gi) => { const gx2 = g.x + g.w / 2; ctrl(Math.min(x + w * 0.55, gx2), y + h / 2, Math.abs(gx2 - (x + w * 0.55)), 0.25 * l0); if (on) { const u = (t * 1.5 + gi * 0.25) % 1, [X, Y] = S(x + w * 0.55 + (gx2 - x - w * 0.55) * u, y + h / 2); dot(X, Y, 2.4, l0, C.ink); } });
                    return 1 - l0;
                }
                if ((b2.kind === 'hbi' || b2.kind === 'nvlink' || b2.kind === 'pcie' || b2.kind === 'c2c') && l0 > 0) {   // lanes: lines with bits riding them
                    const n = b2.kind === 'hbi' ? 60 : b2.kind === 'nvlink' ? 36 : b2.kind === 'pcie' ? 16 : 28, gap = h / n, speed = b2.kind === 'hbi' ? 2 : 0.8;
                    for (let q = 0; q < n; q++) { const yy = y + (q + 0.5) * gap; reg(x + w * 0.04, yy - gap * 0.45, w * 0.92, gap * 0.9, b2.kind === 'hbi' ? 'die-to-die wire' : b2.kind === 'nvlink' ? `link ${(q >> 1) + 1} of 18 · lane ${(q % 2) + 1}` : `lane ${q + 1}`, false); if (b2.kind === 'nvlink' && q % 2 === 0) rectD(x + w * 0.04, yy - gap * 0.45, w * 0.92, gap * 1.9, 0.25 * l0, C.ink3); ctrl(x + w * 0.08, yy, w * 0.84, 0.5 * l0);
                        if (on || b2.kind !== 'hbi') { const dir = q % 2 ? 1 : -1, u = ((t * speed * (on ? 1.6 : 0.4) + q * 0.37) % 1 + 1) % 1, [X, Y] = S(x + w * 0.08 + w * 0.84 * (dir > 0 ? u : 1 - u), yy); dot(X, Y, 1.2, l0, C.ink); } }
                    return 1 - l0;
                }
                if (b2.kind === 'nvdec' && l0 > 0) { for (let q = 0; q < 4; q++) { reg(x + w * 0.1, y + h * (0.06 + q * 0.23), w * 0.8, h * 0.2, ['entropy decode', 'inverse transform', 'motion compensation', 'deblocking'][q], false); cells(x + w * 0.1, y + h * (0.06 + q * 0.23), w * 0.8, h * 0.2, 3, 1, 0.5 * l0); } return 1 - l0; }
                return 1;
            };
            // level 0: the floorplan
            rectD(0, 0, 100, 64, 0.5, C.ink2, 3, 0.6);
            st.blocks.forEach((b, k) => {
                if (!vis(b.x, b.y, b.w, b.h)) return;
                const hov = k === st.hb && z < 2.5, col = hov ? C.ink : C.ink2; reg(b.x, b.y, b.w, b.h, F.chip.NAMES[b.kind], b.kind === 'gpc' || F.chip.zmax(st, b) > z * 1.2);   // at its last level a block is an end
                rectD(b.x, b.y, b.w, b.h, hov ? 1 : 0.5, col, 2.6, hov ? 1 : 0.6);
                const tex = { gpc: [5, 0.12], l2: [3.2, 0.22], hbm: [3, 0.26], giga: [3.2, 0.2], nvdec: [3, 0.24], hbi: [2.6, 0.32], nvlink: [2.8, 0.28], c2c: [2.8, 0.28], pcie: [2.8, 0.28] }[b.kind];
                if (b.kind === 'gpc') { if (z < 1.6) { cells(b.x + 0.6, b.y + 0.6, b.w - 1.2, b.h - 1.2, 2, 5, hov ? 0.5 : 0.25);
                } }
                else { const keep = interior(b);   // the component's own levels; its base texture fades as they take over
                    if (keep > 0.02) { if (b.kind === 'giga') ctrl(b.x + 1, b.y + b.h / 2, b.w - 2, (hov ? 1 : 0.5) * keep); else if (b.kind === 'nvdec') cells(b.x + 0.3, b.y + 0.4, b.w - 0.6, b.h - 0.8, 1, 2, (hov ? 0.5 : 0.25) * keep); else stipple(b.x, b.y, b.w, b.h, tex[0], (hov ? 0.5 : 0.25) * keep, C.ink3); } }
                // level 1: a GPC's 10 TPCs (2 SMs each), fading in as you zoom
                const f1 = b.kind === 'gpc' ? fadeIn(1.6, 3.2) : 0;
                if (f1 > 0) for (let tq = 0; tq < 10; tq++) {
                    const ci = tq % 2, ri = Math.floor(tq / 2), tw = (b.w - 1.2) / 2, th = (b.h - 1.2) / 5, tx = b.x + 0.6 + ci * tw, ty = b.y + 0.6 + ri * th;
                    if (!vis(tx, ty, tw, th)) continue;
                    rectD(tx + 0.15, ty + 0.15, tw - 0.3, th - 0.3, 0.25 * f1, C.ink3); reg(tx + 0.15, ty + 0.15, tw - 0.3, th - 0.3, 'TPC · 2 SMs');
                    for (let sm = 0; sm < 2; sm++) {
                        const sx = tx + 0.4 + sm * ((tw - 0.8) / 2), sy = ty + 0.4, sw = (tw - 0.8) / 2 - 0.2, sh = th - 0.8;
                        if (!vis(sx, sy, sw, sh)) continue;
                        const smBusy = smOn();
                        rectD(sx, sy, sw, sh, 0.5 * f1, C.ink2, 2.4, 0.55); reg(sx, sy, sw, sh, 'SM · 128 FP32 lanes, 4 tensor cores');
                        const f2 = fadeIn(9, 16);
                        if (f2 <= 0 || sw * s2 < 20) { cells(sx, sy, sw, sh * 0.84, 2, 2, 0.25 * f1); stipple(sx, sy + sh * 0.84, sw, sh * 0.16, 2, 0.25 * f1, C.ink3); continue; }
                        // level 2: an SM: four quadrants (scheduler, register file, cores, tensor core) above L1 / shared memory
                        const l1h = sh * 0.16, qw = sw / 2, qh = (sh - l1h) / 2;
                        stipple(sx, sy + sh - l1h, sw, l1h, 2.4, 0.25 * f2, C.ink2); reg(sx, sy + sh - l1h, sw, l1h, 'L1 / shared memory · 256 KB', false);   // memory, a field
                        for (let qd = 0; qd < 4; qd++) {
                            const qx = sx + (qd % 2) * qw, qy = sy + Math.floor(qd / 2) * qh;
                            if (!vis(qx, qy, qw, qh)) continue;
                            rectD(qx + qw * 0.04, qy + qh * 0.04, qw * 0.92, qh * 0.92, 0.25 * f2, C.ink3, 2.2, 0.5);
                            ctrl(qx + qw * 0.08, qy + qh * 0.12, qw * 0.84, 1 * f2); reg(qx + qw * 0.08, qy + qh * 0.06, qw * 0.84, qh * 0.12, 'warp scheduler, dispatch', false);   // control, a line
                            stipple(qx + qw * 0.08, qy + qh * 0.22, qw * 0.84, qh * 0.16, 1.6, 0.5 * f2, C.ink2); reg(qx + qw * 0.08, qy + qh * 0.22, qw * 0.84, qh * 0.16, 'register file · 64 KB', false);   // memory, a dense field
                            cells(qx + qw * 0.08, qy + qh * 0.42, qw * 0.4, qh * 0.5, 4, 8, 0.5 * f2); reg(qx + qw * 0.08, qy + qh * 0.42, qw * 0.4, qh * 0.5, '32 FP32 / INT32 lanes', false);   // compute, cells
                            const tcx = qx + qw * 0.54, tcy = qy + qh * 0.42, tcw = qw * 0.38, tch = qh * 0.5;
                            rectD(tcx, tcy, tcw, tch, 1 * f2, C.ink, 2, 0.55); reg(tcx, tcy, tcw, tch, 'tensor core · 5th gen');
                            if (fadeIn(45, 80) <= 0 && z < 900) cells(tcx, tcy, tcw, tch, 4, 3, 0.5 * f2);                               // its MAC array, coarse until level 3
                            // level 3: the tensor core as a grid of multiply-accumulate units, operands flowing in
                            const f3 = fadeIn(45, 80) * (1 - fadeIn(600, 850));   // gone before the single MAC unit comes in
                            if (f3 > 0 && tcw * s2 > 50) {
                                const n = 16, m = 12, mw = tcw / n, mh = tch / m;
                                cells(tcx, tcy, tcw, tch, n, m, 0.5 * f3); if (mw * s2 > 8 && z > 90 && z < 900) for (let a2 = 0; a2 < n; a2++) for (let c3 = 0; c3 < m; c3++) reg(tcx + a2 * mw, tcy + c3 * mh, mw, mh, 'MAC unit', true, 1500);
                                if (smBusy) for (let a = 0; a < n; a++) { const u = (t * 1.2 + a * 0.07) % 1, [X, Y] = S(tcx + (a + 0.5) * mw, tcy + u * tch); dot(X, Y, 2, 0.5 * f3, C.ink); }      // B operands down the columns (while its SM works)
                                if (smBusy) for (let c2 = 0; c2 < m; c2++) { const u = (t * 1.2 + c2 * 0.09) % 1, [X, Y] = S(tcx + u * tcw, tcy + (c2 + 0.5) * mh); dot(X, Y, 2, 0.5 * f3, C.ink); }     // A operands along the rows
                                if (smBusy) for (let a = 0; a < n; a++) for (let c2 = 0; c2 < m; c2++) { const ph = (t * 1.6 - (a + c2) * 0.08) % 1; if (ph < 0.2) { const [X, Y] = S(tcx + (a + 0.5) * mw, tcy + (c2 + 0.5) * mh); dot(X, Y, 1.2, f3, C.ink); } }   // products accumulating, a wave across the array
                                st.deep = true;
                            }
                        }
                    }
                }
            });
            // below the tensor core: logic cells, then FinFET transistors, then the silicon lattice, as patterns
            // anchored at the zoom's target and scaled with it, each fading in as the one before fades out
            if (z > 300 && st.tgt) {
                let [OX, OY] = S(...F.chip.anchor(st, 0)); const mac = st.mac || 0.07, band = (lo, hi, lo2, hi2) => fadeIn(lo, hi) * (1 - fadeIn(lo2, hi2));
                const hash = (i, j) => { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); };
                const grid = (spx, spy, fn) => { const i0 = Math.floor((v.x - OX) / spx) - 1, i1 = Math.ceil((v.x + v.w - OX) / spx) + 1, j0 = Math.floor((v.y - OY) / spy) - 1, j1 = Math.ceil((v.y + v.h - OY) / spy) + 1; const k = Math.max(1, Math.ceil(Math.sqrt(((i1 - i0) * (j1 - j0)) / 1800))); for (let j = j0 - (((j0 % k) + k) % k); j <= j1; j += k) for (let i = i0 - (((i0 % k) + k) % k); i <= i1; i += k) fn(OX + i * spx, OY + j * spy, i, j); };   /* too dense for the view: every k-th cell, never nothing */
                const lineDots = (x0, y0, x1, y1, step, size, a, col) => { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step)); for (let q = 0; q <= n; q++) dot(x0 + ((x1 - x0) * q) / n, y0 + ((y1 - y0) * q) / n, size, a, col); };
                // a multiply-accumulate unit, one, in the middle (its neighbours faint around it): the multiplier's partial
                // products, a parallelogram of AND gates (each row shifted one, as long multiplication is written); the adder tree
                // narrowing 8 → 4 → 2 → 1; the accumulator, a column of flip-flops whose output loops back into the sum. Operands
                // come in at the edges and the product flows right
                const f4 = band(850, 1200, 2000, 2600);   // one level at a time: each fades out before the next comes in
                if (f4 > 0) {
                    const CW = mac * s2, CHh = (st.macH || mac * 0.7) * s2, box = (x0, y0, w0, h0, tone, lw = K.U / 2) => { ctx.globalAlpha = tone * f4; ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.strokeRect(x0, y0, w0, h0); };
                    const UW = Math.min(CW, CHh / 0.7) * 0.9, UH = UW * 0.7, ux = OX - UW / 2, uy = OY - UH / 2; box(ux, uy, UW, UH, 1, K.U);   // the unit, alone
                    const n = 8, mw = (UW * 0.52) / (n * 1.5), mx0 = ux + UW * 0.04, my0 = uy + UH * 0.12, mh = (UH * 0.76) / n;   // the multiplier
                    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) box(mx0 + (c + (n - 1 - r) * 0.5) * mw, my0 + r * mh + mh * 0.15, mw * 0.8, mh * 0.7, 0.5);
                    const tx0 = ux + UW * 0.6, tw = UW * 0.22, rowsT = [8, 4, 2, 1];                                       // the adder tree
                    rowsT.forEach((k, q) => { const ch2 = (UH * 0.76) / 8, colX = tx0 + (q / rowsT.length) * tw; for (let c = 0; c < k; c++) { const yy = uy + UH * 0.12 + ((c + 0.5) * 8 / k - 0.5) * ch2; box(colX, yy + ch2 * 0.1, tw / 5, ch2 * 0.8, 0.5); } });
                    const ax0 = ux + UW * 0.86, aw = UW * 0.08, ach = (UH * 0.76) / 8;                                      // the accumulator
                    for (let c = 0; c < 8; c++) box(ax0, uy + UH * 0.12 + c * ach + ach * 0.1, aw, ach * 0.8, 1);
                    ctx.globalAlpha = 0.5 * f4; ctx.lineWidth = K.U / 2; ctx.beginPath(); ctx.moveTo(ax0 + aw, uy + UH * 0.5); ctx.lineTo(ax0 + aw + UW * 0.03, uy + UH * 0.5); ctx.lineTo(ax0 + aw + UW * 0.03, uy + UH * 0.94); ctx.lineTo(tx0 + tw * 0.75, uy + UH * 0.94); ctx.lineTo(tx0 + tw * 0.75, uy + UH * 0.88); ctx.stroke();   // its loop back into the sum
                    if (!still) { const u = (t * 0.6) % 1; for (let c = 0; c < n; c++) { dot(mx0 + (c + (n - 1) * 0.5) * mw + mw * 0.4, uy + UH * 0.04 + u * UH * 0.08, 1.2, f4, C.ink); dot(ux - UW * 0.02 + u * UW * 0.05, my0 + (c + 0.5) * mh, 1.2, f4, C.ink); }   // operands in
                        dot(tx0 - UW * 0.04 + u * (ax0 - tx0 + UW * 0.04), uy + UH * 0.5, 2.4, f4, C.ink); }                      // the product on its way
                    if (f4 > 0.5) { regS(mx0, my0, tx0 - UW * 0.03, my0 + UH * 0.76, 'multiplier · partial products', true, 5000); regS(tx0, my0, tx0 + tw, my0 + UH * 0.76, 'adder tree · 8 → 1', true, 5000); regS(ax0, my0, ax0 + aw, my0 + UH * 0.76, 'accumulator · flip-flops', true, 5000); }
                }
                // one logic cell of the part clicked, as a circuit: the multiplier's partial product, an AND (a NAND, two pFETs in
                // parallel over two nFETs in series, then an inverter: six transistors between the rails); the adder tree's full adder
                // at gate level (two XORs for the sum, two ANDs and an OR for the carry); the accumulator's bit, a master–slave D
                // flip-flop (a transmission gate into a latch of two inverters, twice, on opposite clock phases)
                [OX, OY] = S(...F.chip.anchor(st, 1));
                const fC = band(2600, 3200, 8000, 10000);
                if (fC > 0) {
                    const Wc = Math.min(v.w * 0.8, v.h * 0.8 / 0.6) * (z / 5000), Hc = Wc * 0.6, P = (u, w) => [OX + (u - 0.5) * Wc, OY + (w - 0.5) * Hc], kind = st.cell || 'fa';
                    const ln = (pts, tone = 0.5, lw = K.U / 2) => { ctx.globalAlpha = tone * fC; ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.setLineDash([]); ctx.beginPath(); pts.forEach(([u, w], k) => { const [X, Y] = P(u, w); if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke(); };
                    const jn = (u, w) => { const [X, Y] = P(u, w); dot(X, Y, 2.4, fC, C.ink); };
                    const txt = (str, u, w, al = 'left') => { const [X, Y] = P(u, w); ctx.globalAlpha = fC; ctx.fillStyle = C.ink2; ctx.font = `10px ${MONO || 'monospace'}`; ctx.textAlign = al; ctx.textBaseline = 'middle'; ctx.fillText(str, X, Y); ctx.textAlign = 'left'; };
                    const port = (str, u, w, name, al = 'right') => { txt(str, u, w - 0.04, al === 'right' ? 'left' : 'right');   /* its name above the wire's end, inside the cell */ const [X, Y] = P(u, w); if (fC > 0.5) regS(X - 6, Y - 6, X + 6, Y + 6, name, false); };
                    if (kind === 'and') {
                        const fet = (u, w, pm, name) => { const h = Hc * 0.07, [X, Y] = P(u, w); ctx.globalAlpha = fC; ctx.strokeStyle = C.ink; ctx.lineWidth = K.U; ctx.strokeRect(X - h * 0.3, Y - h, h * 0.6, 2 * h); ctx.beginPath(); ctx.moveTo(X - h * 0.6, Y - h * 0.8); ctx.lineTo(X - h * 0.6, Y + h * 0.8); ctx.stroke();
                            if (pm) { ctx.beginPath(); ctx.arc(X - h * 0.8, Y, h * 0.2, 0, TAU); ctx.stroke(); } if (fC > 0.5) regS(X - h, Y - h, X + h * 0.3, Y + h, name, true, 14000); };
                        ln([[0.02, 0.08], [0.98, 0.08]], 1, K.U); ln([[0.02, 0.94], [0.98, 0.94]], 1, K.U); txt('VDD', 0.99, 0.08); txt('GND', 0.99, 0.94);
                        fet(0.22, 0.28, 1, 'pFET · pulls X up when a = 0'); fet(0.40, 0.28, 1, 'pFET · pulls X up when b = 0'); fet(0.31, 0.58, 0, 'nFET · on when a = 1'); fet(0.31, 0.80, 0, 'nFET · on when b = 1, in series');
                        fet(0.68, 0.28, 1, 'pFET · inverter pull-up'); fet(0.68, 0.72, 0, 'nFET · inverter pull-down');
                        ln([[0.22, 0.21], [0.22, 0.08]]); ln([[0.40, 0.21], [0.40, 0.08]]); ln([[0.22, 0.35], [0.22, 0.45], [0.58, 0.45]]); ln([[0.40, 0.35], [0.40, 0.45]]); jn(0.40, 0.45);
                        ln([[0.31, 0.45], [0.31, 0.51]]); jn(0.31, 0.45); ln([[0.31, 0.65], [0.31, 0.73]]); ln([[0.31, 0.87], [0.31, 0.94]]);
                        ln([[0.58, 0.28], [0.58, 0.72]]); jn(0.58, 0.45); ln([[0.58, 0.28], [0.63, 0.28]]); ln([[0.58, 0.72], [0.635, 0.72]]);
                        ln([[0.68, 0.21], [0.68, 0.08]]); ln([[0.68, 0.35], [0.68, 0.65]]); ln([[0.68, 0.79], [0.68, 0.94]]); ln([[0.68, 0.5], [0.90, 0.5]]); jn(0.68, 0.5);
                        ln([[0.06, 0.28], [0.17, 0.28]]); ln([[0.10, 0.28], [0.10, 0.58], [0.275, 0.58]]); jn(0.10, 0.28);
                        ln([[0.06, 0.80], [0.275, 0.80]]); ln([[0.14, 0.80], [0.14, 0.40], [0.35, 0.40], [0.35, 0.28]]); jn(0.14, 0.80);
                        port('aᵢ', 0.06, 0.28, 'input · bit i of a'); port('bⱼ', 0.06, 0.80, 'input · bit j of b'); port('aᵢbⱼ', 0.90, 0.5, 'output · one partial product', 'left'); txt('X', 0.47, 0.42);
                    } else if (kind === 'fa') {
                        const gw = 0.045, gate = (u, w, g, name) => { const [X0, Y0] = P(u - gw, w - 0.08), [X1, Y1] = P(u + gw, w + 0.08); ctx.globalAlpha = fC; ctx.strokeStyle = C.ink; ctx.lineWidth = K.U; ctx.strokeRect(X0, Y0, X1 - X0, Y1 - Y0); txt(g, u, w, 'center'); if (fC > 0.5) regS(X0, Y0, X1, Y1, name, true, 14000); };
                        gate(0.35, 0.32, '=1', 'XOR · a ⊕ b, 12 transistors'); gate(0.62, 0.45, '=1', 'XOR · sum s = a ⊕ b ⊕ cin'); gate(0.35, 0.62, '&', 'AND · generate, a·b'); gate(0.62, 0.72, '&', 'AND · propagate, (a ⊕ b)·cin'); gate(0.82, 0.75, '≥1', 'OR · carry out');
                        ln([[0.06, 0.25], [0.18, 0.25], [0.18, 0.28], [0.305, 0.28]]); ln([[0.18, 0.28], [0.18, 0.58], [0.305, 0.58]]); jn(0.18, 0.28);
                        ln([[0.06, 0.40], [0.24, 0.40]]); ln([[0.24, 0.36], [0.305, 0.36]]); ln([[0.24, 0.36], [0.24, 0.66], [0.305, 0.66]]); jn(0.24, 0.40);
                        ln([[0.395, 0.32], [0.48, 0.32], [0.48, 0.41], [0.575, 0.41]]); ln([[0.48, 0.41], [0.48, 0.68], [0.575, 0.68]]); jn(0.48, 0.41);
                        ln([[0.06, 0.86], [0.52, 0.86], [0.52, 0.49], [0.575, 0.49]]); ln([[0.52, 0.76], [0.575, 0.76]]); jn(0.52, 0.76);
                        ln([[0.665, 0.45], [0.98, 0.45]]); ln([[0.395, 0.62], [0.70, 0.62], [0.70, 0.71], [0.775, 0.71]]); ln([[0.665, 0.72], [0.72, 0.72], [0.72, 0.79], [0.775, 0.79]]); ln([[0.865, 0.75], [0.98, 0.75]]);
                        port('a', 0.06, 0.25, 'input · bit of one product'); port('b', 0.06, 0.40, 'input · bit of another'); port('cin', 0.06, 0.86, 'input · carry from the bit below');
                        port('s', 0.98, 0.45, 'output · sum bit', 'left'); port('cout', 0.98, 0.75, 'output · carry to the bit above', 'left');
                    } else {
                        const tri = (u, w, dir, name) => { const L = Hc * 0.09, [X, Y] = P(u, w); ctx.globalAlpha = fC; ctx.strokeStyle = C.ink; ctx.lineWidth = K.U; ctx.beginPath(); ctx.moveTo(X - dir * L, Y - L * 0.8); ctx.lineTo(X - dir * L, Y + L * 0.8); ctx.lineTo(X + dir * L * 0.7, Y); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(X + dir * L * 0.9, Y, L * 0.2, 0, TAU); ctx.stroke(); if (fC > 0.5) regS(X - L, Y - L * 0.8, X + L, Y + L * 0.8, name, true, 14000); };
                        const tg = (u, w, name) => { const L = Hc * 0.07, [X, Y] = P(u, w); ctx.globalAlpha = fC; ctx.strokeStyle = C.ink; ctx.lineWidth = K.U; ctx.beginPath(); ctx.moveTo(X - L, Y - L); ctx.lineTo(X - L, Y + L); ctx.lineTo(X + L, Y - L); ctx.lineTo(X + L, Y + L); ctx.closePath(); ctx.stroke(); if (fC > 0.5) regS(X - L, Y - L, X + L, Y + L, name, true, 14000); };
                        tg(0.16, 0.5, 'transmission gate · nFET + pFET, open while clk = 0'); tri(0.32, 0.5, 1, 'inverter · master latch'); tri(0.32, 0.28, -1, 'inverter · feedback, holds the bit');
                        tg(0.54, 0.5, 'transmission gate · open while clk = 1'); tri(0.70, 0.5, 1, 'inverter · slave latch'); tri(0.70, 0.28, -1, 'inverter · feedback, holds the bit');
                        ln([[0.06, 0.5], [0.12, 0.5]]); ln([[0.20, 0.5], [0.28, 0.5]]); ln([[0.37, 0.5], [0.50, 0.5]]); ln([[0.58, 0.5], [0.66, 0.5]]); ln([[0.75, 0.5], [0.92, 0.5]]);
                        ln([[0.42, 0.5], [0.42, 0.28], [0.37, 0.28]]); ln([[0.27, 0.28], [0.23, 0.28], [0.23, 0.5]]); jn(0.42, 0.5); jn(0.23, 0.5);
                        ln([[0.80, 0.5], [0.80, 0.28], [0.75, 0.28]]); ln([[0.65, 0.28], [0.61, 0.28], [0.61, 0.5]]); jn(0.80, 0.5); jn(0.61, 0.5);
                        ln([[0.06, 0.82], [0.54, 0.82], [0.54, 0.57]]); ln([[0.16, 0.82], [0.16, 0.60]]); jn(0.16, 0.82); { const [X, Y] = P(0.16, 0.585); ctx.globalAlpha = fC; ctx.beginPath(); ctx.arc(X, Y, Hc * 0.015, 0, TAU); ctx.stroke(); }
                        port('D', 0.06, 0.5, 'input · the new sum bit'); port('clk', 0.06, 0.82, 'clock · one cycle per accumulate'); port('Q', 0.92, 0.5, 'output · the stored bit, back into the adder', 'left');
                    }
                }
                // a FinFET, one, in the middle (its neighbours faint): three silicon fins across, the gate wrapped over them (a band,
                // so one gate controls all three), source and drain on either side with their contacts; switched on, charge
                // flows along the fins under the gate, source to drain
                [OX, OY] = S(...F.chip.anchor(st, 2));
                const f5 = band(10000, 13000, 50000, 110000);
                if (f5 > 0) {
                    const TW = mac * s2 * 0.16, TH = TW * 0.8, tx = OX - TW / 2, ty = OY - TH / 2, box = (x0, y0, w0, h0, tone, lw = K.U / 2) => { ctx.globalAlpha = tone * f5; ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.strokeRect(x0, y0, w0, h0); };
                    for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) if (di || dj) box(tx + di * TW * 1.25, ty + dj * TH * 1.3, TW, TH, 0.25);   // the neighbours
                    if (st.fet === 'p') { ctx.globalAlpha = 0.5 * f5; ctx.setLineDash([K.U, 2 * K.U]); ctx.strokeRect(tx - TW * 0.12, ty - TH * 0.15, TW * 1.24, TH * 1.3); ctx.setLineDash([]); }   // a pFET: in an n-well
                    const finY = [0.3, 0.5, 0.7].map((q) => ty + TH * q);
                    ctx.globalAlpha = 0.5 * f5; ctx.lineWidth = K.U; ctx.beginPath(); finY.forEach((y0) => { ctx.moveTo(tx - TW * 0.05, y0); ctx.lineTo(tx + TW * 1.05, y0); }); ctx.stroke();   // fins
                    box(tx + TW * 0.42, ty + TH * 0.12, TW * 0.16, TH * 0.76, 1, K.U * 2);                                // the gate over them
                    box(tx + TW * 0.06, ty + TH * 0.2, TW * 0.28, TH * 0.6, 0.5); box(tx + TW * 0.66, ty + TH * 0.2, TW * 0.28, TH * 0.6, 0.5);   // source, drain
                    finY.forEach((y0) => { dot(tx + TW * 0.2, y0, 2.4, f5, C.ink); dot(tx + TW * 0.8, y0, 2.4, f5, C.ink); });   // contacts
                    if (!still) finY.forEach((y0, k) => { const u = (t * 0.8 + k * 0.3) % 1; dot(tx + TW * (0.2 + 0.6 * u), y0, 1.2, f5, C.ink); });   // charge, source to drain
                    if (f5 > 0.5) { regS(tx + TW * 0.06, ty + TH * 0.2, tx + TW * 0.34, ty + TH * 0.8, 'source', true, 4e5); regS(tx + TW * 0.42, ty + TH * 0.12, tx + TW * 0.58, ty + TH * 0.88, 'gate · wraps 3 fins', true, 4e5); regS(tx + TW * 0.66, ty + TH * 0.2, tx + TW * 0.94, ty + TH * 0.8, 'drain', true, 4e5);
                        finY.forEach((y0) => regS(tx - TW * 0.05, y0 - 4, tx + TW * 1.05, y0 + 4, 'Si fin', true, 4e5)); if (st.fet === 'p') regS(tx - TW * 0.12, ty - TH * 0.15, tx + TW * 1.12, ty + TH * 1.15, 'n-well · the pFET body', false); }
                }
                // the silicon lattice: atoms in pairs (the diamond structure seen along [110]) and their bonds
                const f6 = band(60000, 140000, 2e6, 5e6);
                // below the crystal everything is drawn about the view centre (the target), at a scale that keeps
                // growing with the zoom: an atom, its wavefunction, its nucleus (sizes compressed, the order true)
                const A = st.anc || F.chip.atomNear(st, st.cx, st.cy) || st.tgt, [CX, CY] = S(A[0], A[1]), ring = (r, a, n2, X0 = CX, Y0 = CY) => { const n = n2 || Math.max(24, Math.min(240, Math.round((TAU * r) / 4))); for (let q = 0; q < n; q++) dot(X0 + r * Math.cos((q / n) * TAU), Y0 + r * Math.sin((q / n) * TAU), 0.6, a, C.ink); };
                const zA = Math.max(1, z / 2e6), a0 = (mac / 2500) * st.s0 * 2e6, rOut = 0.5 * a0 * zA ** 0.69, r0 = rOut / 3.8;   // the outer shell, half a lattice spacing at the handover
                const hsh = (q, k) => { const h = Math.sin(q * 12.9898 + k * 78.233) * 43758.5453; return h - Math.floor(h); };
                // the atom, quantum mechanically: one of its four valence sp³ hybrids, ψ ∝ e^(−r/a)(1 + 2.2 (r/a) cos(φ − θ)), as a
                // textbook draws it: contour lines of ψ, positive solid, negative dotted, the node (ψ = 0) a line at context tone.
                // At the end, the nucleus: not marbles but its measured density, flat inside with a soft edge (Woods–Saxon,
                // radius 3.4 fm, skin 0.55 fm), sampled as points
                const f7 = 0, f8 = band(2e6, 5e6, 4e8, 7e8), f9 = fadeIn(7e8, 1.1e9);   // the crystal gives way to one atom's bond orbital
                const TH = [54.7, 125.3, 234.7, 305.3].map((d) => (d * Math.PI) / 180), aV = Math.min(r0 * 1.1, Math.min(v.w, v.h) * 0.11);
                if (f8 > 0) {                                                                                          // one hybrid's ψ as contour lines
                    const RR = Math.max(v.w, v.h) * 0.75, a3 = (Math.min(v.w, v.h) * 0.3 * Math.min(2.5, Math.max(1, z / 5e6) ** 0.25)) / 4.5, th = TH[0], sh = 1.3 * a3 * (1 - fadeIn(1e8, 5e8)), CXo = CX - sh * Math.cos(th), CYo = CY - sh * Math.sin(th), G = 96, X0 = CXo - RR, Y0 = CYo - RR, cs = (2 * RR) / G;
                    const psi = (x, y) => { const dx = x - CXo, dy = y - CYo, r = Math.hypot(dx, dy) / a3, c = r ? (dx * Math.cos(th) + dy * Math.sin(th)) / (r * a3) : 0; return Math.exp(-r) * (1 + 2.2 * r * c); };
                    const V = new Float64Array((G + 1) * (G + 1)); let mx = 0; for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) { const val = psi(X0 + i * cs, Y0 + j * cs); V[j * (G + 1) + i] = val; mx = Math.max(mx, Math.abs(val)); }
                    const iso = (lv, solid, tone) => { ctx.globalAlpha = tone * f8; ctx.strokeStyle = C.ink; ctx.lineWidth = solid ? K.U : K.U / 2; ctx.setLineDash(solid ? [] : [K.U, 2 * K.U]); ctx.beginPath();
                        for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const c4 = [V[j * (G + 1) + i] - lv, V[j * (G + 1) + i + 1] - lv, V[(j + 1) * (G + 1) + i + 1] - lv, V[(j + 1) * (G + 1) + i] - lv], xy = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], cut = [];
                            for (let e = 0; e < 4; e++) { const p0 = c4[e], p1 = c4[(e + 1) % 4]; if ((p0 > 0) !== (p1 > 0)) { const f = p0 / (p0 - p1), A0 = xy[e], A1 = xy[(e + 1) % 4]; cut.push([X0 + (A0[0] + (A1[0] - A0[0]) * f) * cs, Y0 + (A0[1] + (A1[1] - A0[1]) * f) * cs]); } }
                            for (let e = 0; e + 1 < cut.length; e += 2) { ctx.moveTo(cut[e][0], cut[e][1]); ctx.lineTo(cut[e + 1][0], cut[e + 1][1]); } }
                        ctx.stroke(); ctx.setLineDash([]); };
                    [0.08, 0.25, 0.5, 0.8].forEach((q) => iso(q * mx, true, 1)); [0.04, 0.1].forEach((q) => iso(-q * mx, false, 0.5)); iso(0, false, 0.25);
                    dot(CXo, CYo, 2.4, f8, C.ink);
                    if (f8 > 0.5) { const bb = (sel) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) if (sel(V[j * (G + 1) + i])) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); } return [X0 + x0 * cs, Y0 + y0 * cs, X0 + x1 * cs, Y0 + y1 * cs]; };   // each lobe's box: its outermost drawn contour
                        regS(...bb((q) => q > 0.08 * mx), 'ψ > 0 · bond lobe', true, 1.5e9); regS(...bb((q) => q < -0.04 * mx), 'ψ < 0 · back lobe', true, 1.5e9); regS(CXo - 6, CYo - 6, CXo + 6, CYo + 6, 'nucleus', true, 1.5e9); }
                }
                if (f9 > 0) {                                                                                           // the nucleus: its density, sampled
                    if (!st.nuc) { const P3 = []; for (let q = 0; q < 1600; q++) { let r; for (;;) { r = Math.random() * 1.6; if (Math.random() < (r * r * 2.6) / (1 + Math.exp((r - 1) / 0.16)) / 1.1) break; } const c = 2 * Math.random() - 1, an = Math.random() * TAU; P3.push([r * Math.sqrt(1 - c * c), an]); } st.nuc = P3; }
                    const RN = Math.min(v.w, v.h) * 0.3; st.nuc.forEach(([r, an]) => dot(CX + r * RN * Math.cos(an), CY + r * RN * Math.sin(an), 0.6, 0.5 * f9, C.ink));
                    ring(RN, 0.5 * f9); if (f9 > 0.5) regS(CX - RN, CY - RN, CX + RN, CY + RN, 'Si-28 nucleus · 14 p, 14 n', false);   // the radius, 3.4 fm
                }
                [OX, OY] = S(...F.chip.anchor(st, 3));
                if (f6 > 0) { const a2 = (mac / 2500) * s2, b2 = a2 * 1.41;
                    // what the clicked part is made of: the fin, crystalline Si; source and drain, Si with phosphorus donors (about one
                    // atom in thirty here, far denser in a real n⁺ region but shown sparse to stay legible); the gate, the stack above
                    // the channel: amorphous TiN metal, a ~2 nm HfO₂ high-k oxide (four rows), then the Si channel
                    const mat = st.mat || 'si', r1 = Math.min(4, a2 * 0.12), hr = Math.max(4, a2 * 0.12);
                    grid(a2, b2, (x, y, i, j) => { const off = (j % 2) * a2 * 0.5, ax = x + off, ay = y, bx = ax + a2 * 0.25, by = ay + b2 * 0.25, [ux2, uy2] = F.chip.toC(st, ax, ay);
                        if (mat === 'gate' && j < 0) { const jx = (hash(i, j) - 0.5) * a2 * 0.5, jy = (hash(j, i) - 0.5) * b2 * 0.4, ox = j >= -4;   // above the channel: no lattice
                            dot(ax + jx, ay + jy, ox ? r1 : r1 * 0.7, (ox ? 1 : 0.5) * f6, C.ink); if (ox) dot(ax + jx + a2 * 0.3, ay + jy + b2 * 0.2, r1 * 0.5, 0.5 * f6, C.ink);
                            if (f6 > 0.5) regS(ax + jx - hr, ay + jy - hr, ax + jx + hr, ay + jy + hr, ox ? 'HfO₂ · high-k gate oxide, ~2 nm' : 'TiN · gate metal, amorphous', false); return; }
                        const dop = mat === 'doped' && hash(i, j) < 0.035;
                        if (dop) { ctx.globalAlpha = f6; ctx.strokeStyle = C.ink; ctx.lineWidth = K.U; ctx.beginPath(); ctx.arc(ax, ay, Math.max(3, r1 * 1.6), 0, TAU); ctx.stroke(); if (st.fet === 'p') dot(ax, ay, 0.6, f6, C.ink); }   // a donor an open ring, an acceptor a ring round a point else dot(ax, ay, r1, 1 * f6, C.ink);
                        dot(bx, by, r1, 1 * f6, C.ink);
                        if (f6 > 0.5) { const [ub, vb] = F.chip.toC(st, bx, by), mx2 = (ax + bx) / 2, my2 = (ay + by) / 2; regS(bx - hr, by - hr, bx + hr, by + hr, 'Si atom · 4 sp³ bonds', true, 3e7, [ub, vb]); regS(mx2 - hr * 0.8, my2 - hr * 0.8, mx2 + hr * 0.8, my2 + hr * 0.8, 'Si–Si bond · 2 shared e⁻, 0.235 nm', false); }   // the pair's second atom, and the bond between them
                        if (f6 > 0.5) regS(ax - hr, ay - hr, ax + hr, ay + hr, dop ? (st.fet === 'p' ? 'B acceptor · 3 valence e⁻, one hole' : 'P donor · 5 valence e⁻, one free') : 'Si atom · 4 sp³ bonds', !dop, 3e7, dop ? null : [ux2, uy2]);
                        lineDots(ax, ay, bx, by, 2.5, 0.5, 0.5 * f6, C.ink2); lineDots(bx, by, bx + a2 * 0.25, by - b2 * 0.25 + b2 * 0.5 * 0, 2.5, 0.45, 0.25 * f6, C.ink3); });
                }
            }
            // wiring for the hovered block (chip level)
            const hb = st.blocks[st.hb];
            if (hb && z < 2.5) {
                F.chip.wires(st, hb).forEach((path, wi) => {
                    ctx.globalAlpha = 1; ctx.strokeStyle = C.ink; ctx.lineWidth = K.U; ctx.setLineDash([]); ctx.beginPath(); path.forEach((p2, k) => { const [X, Y] = S(...p2); if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke();
                    // a pulse riding the wire
                    const segs = path.slice(1).map((p, k) => Math.hypot(p[0] - path[k][0], p[1] - path[k][1])), L2 = segs.reduce((a, b) => a + b, 0); let d = ((t * 22 + wi * 9) % L2);
                    for (let k = 0; k < segs.length; k++) { if (d <= segs[k]) { const f = d / segs[k], p = [path[k][0] + (path[k + 1][0] - path[k][0]) * f, path[k][1] + (path[k + 1][1] - path[k][1]) * f], [X, Y] = S(...p); dot(X, Y, 2, 1, C.ink); break; } d -= segs[k]; }
                });
            }
            st.hits = hits;   // kept for inspection
            // the hovered component: the smallest box under the pointer, outlined at full tone, its name by the pointer
            st.hit = null;
            if (st.mouse && !st.press) { const [mx, my] = st.mouse; let best = null; hits.forEach((h2) => { if (mx >= h2[0] && mx <= h2[2] && my >= h2[1] && my <= h2[3]) { const ar = (h2[2] - h2[0]) * (h2[3] - h2[1]); if (!best || ar <= best[8]) best = [...h2, ar]; } });   // equal boxes: the later, deeper one
                if (best) { st.hit = best[4] + (best[5] ? '  ›' : ''); st.hitObj = { box: best.slice(0, 4), deeper: best[5], goZ: best[6], anc: best[7], name: best[4] }; ctx.globalAlpha = 1; ctx.strokeStyle = C.ink; ctx.lineWidth = K.U; ctx.setLineDash(best[5] ? [] : [K.U, 2 * K.U]); ctx.strokeRect(best[0], best[1], best[2] - best[0], best[3] - best[1]); ctx.setLineDash([]); } else st.hitObj = null; }
            if (st.flash) { const e = (performance.now() - st.flash.t) / 1000, [x0, y0, x1, y1] = st.flash.box; if (e > 0.8) st.flash = null; else { ctx.globalAlpha = Math.floor(e * 5) % 2 ? 0.25 : 1; ctx.strokeStyle = C.ink; ctx.lineWidth = K.U * 2; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); if (st.hit) st.hit = st.hit.replace('  ›', '') + ' · deepest level'; st.wake = Math.max(st.wake || 0, 0.2); } }   // an end, clicked: it flashes
            ctx.restore();
            if (st.hit) label(ctx, C, st, st.hit, st.mouse[0] + K.LN / 2, st.mouse[1] - K.LN / 2, 'left', true);
            // labels
            const level = z < 2.5 ? 'chip' : z < 12 ? 'GPC · 10 TPCs × 2 SMs' : z < 55 ? 'SM · 4 quadrants, L1 / shared memory' : z < 700 ? 'tensor core · MAC array' : z < 3000 ? 'MAC unit · multiplier, adder tree, accumulator' : z < 11000 ? (st.cell === 'and' ? 'AND cell · NAND + inverter, 6 transistors' : st.cell === 'ff' ? 'D flip-flop · master–slave latches' : 'full adder · 2 XOR, 2 AND, 1 OR') : z < 90000 ? (st.fet === 'p' ? 'pFET · fins in an n-well, p⁺ source and drain' : 'nFET · gate over 3 fins, n⁺ source and drain') : z < 3e6 ? (st.mat === 'doped' ? (st.fet === 'p' ? 'p⁺ Si · boron acceptors in the lattice' : 'n⁺ Si · phosphorus donors in the lattice') : st.mat === 'gate' ? 'gate stack · TiN / HfO₂ / Si channel' : 'Si crystal · 0.54 nm lattice') : z < 7e8 ? 'Si atom · sp³ bond orbital ψ' : 'nucleus · Woods–Saxon density, r ≈ 3.4 fm';
            const cb = st.blocks[F.chip.at(st, st.cx, st.cy)], deepIn = cb && cb.kind !== 'gpc' && z >= 2.5 ? (F.chip.DEPTH[cb.kind] || []).filter((d, k) => lvl(cb, k) > 0.5).pop() : null;
            st.levelText = deepIn ? deepIn[1] : level;
            label(ctx, C, st, deepIn ? deepIn[1] : `${level} · ${z < 10 ? z.toFixed(1) : z < 10000 ? Math.round(z) : z < 1e6 ? Math.round(z / 1000) + 'k' : '10' + String(Math.floor(Math.log10(z))).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('')}×`, st.fx + K.LN / 4, st.vy0 + K.LN / 4, 'left', true);
            if (!still && (st.fly || st.press || (hb && z < 2.5) || z > 40)) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // A transformer, faithfully wired and laid out so attention reads at a glance. Tokens are rows, top to
    // bottom, each row its residual stream; layers run left to right. Every block reads each row through a
    // LayerNorm (the dot pair at its entry) and adds its output back into the same row at a ⊕ (x ← x + f(LN(x))).
    // Attention is the only place rows exchange information, always downward, from earlier tokens to later
    // ones; its two heads sit one behind the other in depth. The MLP acts on each row alone, fanning out in
    // depth four times and back. After each attention block, a strip of dots on every row shows what that
    // token now holds, one dot per source token: a causal staircase filling in layer by layer. A click runs
    // a forward pass on a new sentence (pulses run down the attention connections); hover a token in a
    // block for what it reads; drag to orbit.
    F.tfm = {
        bleed: true, tall: true, L: 3, HEADS: 2,
        title: 'Transformer', note: 'Tokens as rows through attention and MLP blocks; attention passes information down from earlier tokens to later ones.',
        // tokens, next-token candidates, and for each token the earlier token head 2 reads (its content link)
        SENTENCES: [
            [['The', 'cat', 'sat', 'on', 'the'], ['mat', 'floor', 'sofa'], [0, 0, 1, 1, 2]],
            [['Paris', 'is', 'the', 'capital', 'of'], ['France', 'Europe', 'fashion'], [0, 0, 0, 0, 3]],
            [['Attention', 'is', 'all', 'you'], ['need', 'want', 'get'], [0, 0, 0, 0]],
            [['Two', 'plus', 'two', 'is'], ['four', 'five', 'two'], [0, 0, 0, 2]],
            [['Deep', 'networks', 'learn'], ['features', 'slowly', 'fast'], [0, 0, 1]],
        ],
        init(R, rand) {
            const r = rand(83), x0 = (R.fx ?? R.x) + 2, x1 = R.x + R.w - 64, vy0 = (R.vy0 ?? R.y) + 14, vy1 = (R.vy1 ?? R.y + R.h) - 4;   // room at the right for the output words
            const blocks = []; let x = 26;
            for (let l = 0; l < F.tfm.L; l++) { blocks.push({ kind: 'attn', l, x, len: 34 }); x += 34 + 20; blocks.push({ kind: 'mlp', l, x, len: 12 }); x += 12 + 12; }
            const st = { r, x0, x1, vy0, vy1, blocks, outX: x + 2, span: x + 40, yaw: 0.9, pitch: 0.42, zd: 9, row: 24, sent: 0, play: null, hv: null };
            F.tfm.setSentence(st, 0);
            return st;
        },
        setSentence(st, k) {
            st.sent = k; const [toks] = F.tfm.SENTENCES[k]; st.T = toks.length;
            // fixed patterns: head 1 reads the previous token, head 2 the token that matters; a little to itself; the same in every layer, sharpening with depth
            const link = F.tfm.SENTENCES[k][2];
            st.att = Array.from({ length: F.tfm.L }, (_, l) => Array.from({ length: F.tfm.HEADS }, (_, hd) => Array.from({ length: st.T }, (_, q) => {
                const target = hd === 0 ? Math.max(0, q - 1) : link[q], sharp = 2.2 + l * 0.6;
                const w = Array.from({ length: q + 1 }, (_, kk) => Math.exp((kk === target ? sharp : 0) + (kk === q ? 0.8 : 0))), s2 = w.reduce((a, b) => a + b, 0); return w.map((v) => v / s2);
            })));
            st.probs = [0.62, 0.24, 0.14];
            let comp = Array.from({ length: st.T }, (_, q) => Array.from({ length: st.T }, (_, kk) => (kk === q ? 1 : 0)));
            st.comp = st.att.map((heads) => { const mix = Array.from({ length: st.T }, (_, q) => Array.from({ length: st.T }, (_, kk) => (kk <= q ? heads.reduce((s2, h) => s2 + h[q][kk], 0) / heads.length : 0))); comp = comp.map((row, q) => { const nw = row.map((v, kk) => 0.5 * v + 0.5 * mix[q].reduce((s2, m, j) => s2 + m * comp[j][kk], 0)), z = nw.reduce((a, b) => a + b, 0); return nw.map((v) => v / z); }); return comp; });
        },
        y(st, q) { return ((st.T - 1) / 2 - q) * st.row; },
        cam(st) {
            const kx = Math.cos(st.yaw) * st.pitch, ky = Math.sin(st.yaw) * st.pitch, xc = st.span / 2, raw = (x, y, z) => [(x - xc) + z * kx, -y - z * ky];
            if (!st.fit || st.fit.k !== `${st.yaw},${st.pitch},${st.T}`) {
                let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; const take = (x, y, z) => { const [X, Y] = raw(x, y, z); a = Math.min(a, X); b = Math.max(b, X); c = Math.min(c, Y); d = Math.max(d, Y); };
                const yh = ((st.T - 1) / 2) * st.row + 8;
                [[-14, yh], [st.span, yh + 30]].forEach(([x, h]) => [-1, 1].forEach((sy) => [-1, 1].forEach((sz) => take(x, sy * h, sz * st.zd))));
                const s2 = Math.min((st.x1 - st.x0) / (b - a), (st.vy1 - st.vy0) / (d - c));
                st.fit = { k: `${st.yaw},${st.pitch},${st.T}`, s: s2, ox: (st.x0 + st.x1) / 2 - ((a + b) / 2) * s2, oy: (st.vy0 + st.vy1) / 2 - ((c + d) / 2) * s2 };
            }
            const f = st.fit; return (x, y, z) => { const [X, Y] = raw(x, y, z); return [f.ox + X * f.s, f.oy + Y * f.s]; };
        },
        pointer(type, x, y, st) {
            if (type === 'enter') return;
            if (type === 'leave') { st.hv = null; return; }
            const P = F.tfm.cam(st);
            if (type === 'down') { st.press = { x, y, yaw: st.yaw, pitch: st.pitch, moved: false }; return; }
            if (type === 'move' && st.press) { if (Math.hypot(x - st.press.x, y - st.press.y) > 4) st.press.moved = true; st.press.lx = x; st.press.ly = y; if (st.press.moved) { st.yaw = Math.max(-1.4, Math.min(1.4, st.press.yaw - (y - st.press.y) * 0.008)); st.pitch = Math.max(0, Math.min(1.4, st.press.pitch + (x - st.press.x) * 0.005)); st.hv = null; st.wake = 0.4; } return; }
            if (type === 'up' && st.press) { const moved = st.press.moved; st.press = null; if (!moved) { F.tfm.setSentence(st, (st.sent + 1) % F.tfm.SENTENCES.length); st.fit = null; st.play = { start: null }; st.wake = 8.4; } return; }
            let best = null, bd = Infinity;
            st.blocks.forEach((B, bi) => { for (let q = 0; q < st.T; q++) { const [px, py] = P(B.x + B.len / 2, F.tfm.y(st, q), 0), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = { bi, q }; } } });
            st.hv = bd < 30 ? best : null; st.wake = Math.max(st.wake || 0, 0.25);
        },
        draw(ctx, R, t, C, st, still) {
            const P = F.tfm.cam(st), dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            const seg = (A, B, step, size, a, col) => { const n = Math.max(2, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / step)); for (let i = 0; i <= n; i++) dot(A[0] + ((B[0] - A[0]) * i) / n, A[1] + ((B[1] - A[1]) * i) / n, size, a, col); };
            const L3 = (a, b, step, size, al, col) => seg(P(...a), P(...b), step, size, al, col);
            let fw = 1; if (st.play && !still) { if (st.play.start == null) st.play.start = t; fw = Math.min(1, (t - st.play.start) / 8); if (fw >= 1) st.play = null; }
            const warp = (() => { const end = st.outX + 14, att = st.blocks.filter((B) => B.kind === 'attn').map((B) => [B.x - 4, B.x + B.len + 4]); const cost = (x) => x + att.reduce((s2, [p, q]) => s2 + 2 * Math.max(0, Math.min(x, q) - p), 0), total = cost(end), want = fw * total; let lo = 0, hi = end; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (cost(m) < want) lo = m; else hi = m; } return (lo + hi) / 2; })();
            const playing = st.play && !still, front = playing ? warp : st.outX + 14, [toks, outs] = F.tfm.SENTENCES[st.sent], T = st.T, zd = st.zd, yh = ((T - 1) / 2) * st.row + 7;
            const hv = st.hv, hq = hv ? hv.q : -1, past = (x) => !playing || x < front;
            // embeddings: a plane, one vector of dots per token row
            [[-1, -1, -1, 1], [-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1]].forEach(([a, b, c, d]) => L3([0, a * yh, b * zd], [0, c * yh, d * zd], 3, 0.6, 0.7, C.ink2));
            for (let q = 0; q < T; q++) for (let k = 0; k < 6; k++) { const [px, py] = P(0, F.tfm.y(st, q), -zd + 2 + k * ((2 * zd - 4) / 5)), on = ((q * 7 + k * 3 + st.sent) % 5) < 3; dot(px, py, on ? 1.2 : 0.6, on ? 0.85 : 0.3, on ? C.ink : C.ink3); }
            // residual rows
            for (let q = 0; q < T; q++) { const y = F.tfm.y(st, q), lit = q === hq; L3([0, y, 0], [st.outX, y, 0], 3, lit ? 0.85 : 0.6, lit ? 0.95 : 0.45, lit ? C.ink : C.ink3); if (playing) L3([0, y, 0], [Math.min(front, st.outX), y, 0], 2.2, 0.95, 0.85, C.ink); }
            st.blocks.forEach((B, bi) => {
                const x0 = B.x, x1 = B.x + B.len, isH = hv && hv.bi === bi, col = isH ? C.ink : C.ink2, a = isH ? 0.95 : 0.7;
                // the box: spans every row, with depth for the heads
                const V = (x, sy, sz) => [x, sy * yh, sz * zd];
                [[-1, -1], [-1, 1], [1, 1], [1, -1]].forEach(([p, q]) => L3(V(x0, p, q), V(x1, p, q), 3, 0.5, a * 0.8, col));
                [x0, x1].forEach((x) => [[-1, -1, -1, 1], [-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1]].forEach(([p, q, p2, q2]) => L3(V(x, p, q), V(x, p2, q2), 3, 0.5, a, col)));
                const inside = past(x0), mixU = playing ? Math.max(0, Math.min(1, (front - x0) / B.len)) : 1;
                for (let q = 0; q < T; q++) {
                    const y = F.tfm.y(st, q), read = past(x0 - 3), write = past(x1 + 3);
                    const [lx, ly] = P(x0 - 3, y, 0); dot(lx - 1.6, ly, 0.9, read ? 0.8 : 0.25, C.ink2); dot(lx + 1.6, ly, 0.9, read ? 0.8 : 0.25, C.ink2);    // LayerNorm
                    const [ox, oy] = P(x1 + 3, y, 0); for (let m = 0; m < 12; m++) { const an = (m / 12) * TAU; dot(ox + 2.8 * Math.cos(an), oy + 2.8 * Math.sin(an), 0.45, write ? 0.85 : 0.3, C.ink2); }
                    seg([ox - 1.5, oy], [ox + 1.5, oy], 1.1, 0.4, write ? 0.85 : 0.3, C.ink2); seg([ox, oy - 1.5], [ox, oy + 1.5], 1.1, 0.4, write ? 0.85 : 0.3, C.ink2);
                }
                if (B.kind === 'attn') {
                    // each head as its attention pattern: columns are the tokens read, rows sit on the reading tokens;
                    // a token's information runs down its column, each later row takes its share where it crosses
                    const gw = (B.len - 6) / 2;
                    for (let hd = 0; hd < F.tfm.HEADS; hd++) {
                        const gx = x0 + 2 + hd * (gw + 2), cw = gw / T, colX = (k) => gx + (k + 0.5) * cw;
                        for (let k = 0; k < T; k++) {
                            const yk = F.tfm.y(st, k), yEnd = F.tfm.y(st, T - 1);
                            // the column: from token k's own row down to the last row
                            const reach = playing ? Math.max(0, Math.min(1, mixU * 1.25 - k * 0.05)) : 1, yr = yk + (yEnd - yk) * reach;
                            if (inside) L3([colX(k), yk, 0], [colX(k), yr, 0], 3, 0.45, 0.35, C.ink3);
                            if (playing && reach > 0 && reach < 1) { const [px, py] = P(colX(k), yr, 0); dot(px, py, 1.6, 0.9, C.ink); }
                            for (let q = k; q < T; q++) {
                                const w = st.att[B.l][hd][q][k], yq = F.tfm.y(st, q), on = inside && (!playing || yq >= yr - 0.5), sel = isH && q === hq;
                                const [px, py] = P(colX(k), yq, 0);
                                if (on) dot(px, py, 0.6 + 2.6 * Math.sqrt(w), sel ? 1 : 0.35 + 0.6 * w, w > 0.3 || sel ? C.ink : C.ink2);
                                else dot(px, py, 0.4, 0.15, C.ink3);
                            }
                        }
                        // the empty upper corner: no token reads a later one
                        for (let q = 0; q < T; q++) for (let k = q + 1; k < T; k++) { const [px, py] = P(colX(k), F.tfm.y(st, q), 0); dot(px, py, 0.3, 0.12, C.ink3); }
                    }
                    // what each token now holds: a strip of dots after the ⊕, one per source token
                    if (past(x1 + 4)) for (let q = 0; q < T; q++) { const row = st.comp[B.l][q]; for (let k = 0; k < T; k++) { const [px, py] = P(x1 + 7 + k * 2.6, F.tfm.y(st, q), 0); if (k <= q) dot(px, py, 0.5 + 1.6 * Math.sqrt(row[k]), 0.9, k === q ? C.ink : C.ink2); else dot(px, py, 0.4, 0.18, C.ink3); } }
                } else if (inside) {
                    // the MLP: each token alone, fanning out in depth four times and back
                    for (let q = 0; q < T; q++) { const y = F.tfm.y(st, q), sel = q === hq && isH; for (let j = 0; j < 4; j++) { const zz = (j - 1.5) * (zd * 0.45); for (let i = 1; i < 12; i++) { const u = i / 12; if (u > mixU) break; const [px, py] = P(x0 + u * B.len, y, zz * Math.sin(u * Math.PI)); dot(px, py, 0.45, sel ? 0.85 : 0.25, sel ? C.ink : C.ink3); } } }
                }
            });
            // the end: final LayerNorm on the last token's row, unembedding, next-token probabilities
            const oy0 = F.tfm.y(st, T - 1), done = !playing || front > st.outX;
            const [lx, ly] = P(st.outX - 2, oy0, 0); dot(lx - 1.6, ly, 0.9, done ? 0.8 : 0.25, C.ink2); dot(lx + 1.6, ly, 0.9, done ? 0.8 : 0.25, C.ink2);
            st.probs.forEach((p, k) => { const by = oy0 + (1 - k) * 9, bx = st.outX + 4; for (let m = 0; m < Math.round(p * 10); m++) { const [px, py] = P(bx + m * 2.2, by, 0); dot(px, py, 1, done ? (k ? 0.5 : 0.95) : 0.12, k ? C.ink2 : C.ink); } if (done) { const [px, py] = P(bx + 24, by, 0); label(ctx, C, st, `${outs[k]} ${Math.round(p * 100)}%`, px, py, 'left', k === 0); } });
            for (let q = 0; q < T; q++) { const [px, py] = P(-5, F.tfm.y(st, q), 0); label(ctx, C, st, toks[q], px, py, 'right', q === hq); }
            if (hv) { const B = st.blocks[hv.bi], [px, py] = P(B.x + B.len / 2, yh + 6, 0);
                if (B.kind === 'attn') { const w0 = st.att[B.l][0][hv.q], w1 = st.att[B.l][1][hv.q], k0 = w0.indexOf(Math.max(...w0)), k1 = w1.indexOf(Math.max(...w1)); label(ctx, C, st, `layer ${B.l + 1} attention · row “${toks[hv.q]}”: reads “${toks[k0]}” (head 1), “${toks[k1]}” (head 2)`, px, py, 'center', true); }
                else label(ctx, C, st, `layer ${B.l + 1} MLP · “${toks[hv.q]}” alone, 4× wider inside`, px, py, 'center', true); }
            label(ctx, C, st, 'rows: tokens · in attention, a dot at column k on row q = how much q reads k · click: next sentence', st.x1, st.vy0 - 8, 'right');
            if (!still && st.play) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // Scaling laws (Hoffmann et al., the Chinchilla fit): L(N, D) = E + A/N^α + B/D^β, with compute C ≈ 6ND.
    // The plane is log N (parameters) across and log D (training tokens) up; loss as a dot screen, darker
    // where it is lower. Diagonals are constant compute; the frontier is the compute-optimal split. Three
    // axes slide: N along the bottom, D on the left, and C on the right, which moves the model along the
    // frontier. Drag the point to set N and D together; the loss bar beside the plane follows.
    F.scaling = {
        bleed: true, tall: true, E: 1.69, A: 406.4, B: 410.7, a: 0.34, b: 0.28, N0: 7, N1: 12, D0: 8, D1: 13, C0: 18, C1: 26,
        title: 'Scaling laws', note: 'Loss over parameters and tokens (the Chinchilla fit), constant-compute diagonals, the compute-optimal frontier; slide N, D or C.',
        L(n, d) { const S = F.scaling; return S.E + S.A / 10 ** (S.a * n) + S.B / 10 ** (S.b * d); },
        opt(c) { const S = F.scaling; let best = null; for (let n = S.N0; n <= S.N1; n += 0.01) { const d = c - Math.log10(6) - n; if (d < S.D0 || d > S.D1) continue; const l = S.L(n, d); if (!best || l < best[2]) best = [n, d, l]; } return best; },
        init(R) {
            const fx = R.fx ?? R.x, vy0 = (R.vy0 ?? R.y) + 8, vy1 = (R.vy1 ?? R.y + R.h) - 18, W = R.x + R.w - fx;
            const size = Math.min(vy1 - vy0, W - 200), plane = { x: fx + 84, y: vy0, w: size, h: size };   // room at the left for the D label
            return { fx, vy0, vy1, W, plane, n: 9.5, d: 11, mode: null, lossX: plane.x + size + 22, cX: plane.x + size + 64 };
        },
        px(st, n, d) { const S = F.scaling, p = st.plane; return [p.x + ((n - S.N0) / (S.N1 - S.N0)) * p.w, p.y + p.h - ((d - S.D0) / (S.D1 - S.D0)) * p.h]; },
        nd(st, x, y) { const S = F.scaling, p = st.plane; return [S.N0 + ((x - p.x) / p.w) * (S.N1 - S.N0), S.D0 + ((p.y + p.h - y) / p.h) * (S.D1 - S.D0)]; },
        cOf(st) { return Math.log10(6) + st.n + st.d; },
        pointer(type, x, y, st) {
            if (type === 'enter' || type === 'leave') return;
            const S = F.scaling, p = st.plane, clampN = (v) => Math.max(S.N0, Math.min(S.N1, v)), clampD = (v) => Math.max(S.D0, Math.min(S.D1, v));
            if (type === 'down') st.mode = y > p.y + p.h + 4 ? 'n' : x < p.x - 4 ? 'd' : x > st.lossX + 16 ? 'c' : x > p.x + p.w ? null : 'pt';
            if (type === 'up') { st.mode = null; return; }
            if (!st.mode || (type !== 'down' && type !== 'move')) return;
            const [n, d] = F.scaling.nd(st, x, y);
            if (st.mode === 'n') st.n = clampN(n); else if (st.mode === 'd') st.d = clampD(d); else if (st.mode === 'pt') { st.n = clampN(n); st.d = clampD(d); }
            else { const c = S.C0 + ((p.y + p.h - y) / p.h) * (S.C1 - S.C0), o = F.scaling.opt(Math.max(S.C0 + 0.5, Math.min(S.C1 - 0.3, c))); if (o) { st.n = o[0]; st.d = o[1]; } }
            st.wake = 0.4;
        },
        draw(ctx, R, t, C, st, still) {
            const S = F.scaling, p = st.plane, P = (n, d) => F.scaling.px(st, n, d);
            const dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; if (r2 < 1.4) { ctx.fillRect(x - r2, y - r2, 2 * r2, 2 * r2); return; } ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            const line = (pts, w, a, col, dash) => { ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]); };
            // the loss field
            const lmin = S.L(S.N1, S.D1), lmax = S.L(S.N0, S.D0), G = 24;
            for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) { const n = S.N0 + (i / G) * (S.N1 - S.N0), d = S.D0 + (j / G) * (S.D1 - S.D0), q = 1 - (S.L(n, d) - lmin) / (lmax - lmin), [x, y] = P(n, d); dot(x, y, 0.4 + 1.8 * q * q, 0.2 + 0.55 * q, C.ink2); }
            line([[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h], [p.x, p.y]], 0.8, 0.6, C.ink3);
            // constant-compute diagonals, the current one stronger, and the compute-optimal frontier
            const cNow = F.scaling.cOf(st);
            for (let c = 19; c <= 25; c++) { const pts = []; for (let n = S.N0; n <= S.N1; n += 0.05) { const d = c - Math.log10(6) - n; if (d >= S.D0 && d <= S.D1) pts.push(P(n, d)); } if (pts.length > 1) line(pts, 0.6, 0.3, C.ink3, [2, 3]); }
            { const pts = []; for (let n = S.N0; n <= S.N1; n += 0.05) { const d = cNow - Math.log10(6) - n; if (d >= S.D0 && d <= S.D1) pts.push(P(n, d)); } if (pts.length > 1) line(pts, 1, 0.8, C.ink2, [3, 2]); }
            const fr = []; for (let c = S.C0; c <= S.C1; c += 0.1) { const o = F.scaling.opt(c); if (o) fr.push(P(o[0], o[1])); } line(fr, 1.4, 0.9, C.ink);
            // the model: a point with guides to the N and D axes
            const [mx, my] = P(st.n, st.d), loss = S.L(st.n, st.d);
            line([[mx, my], [mx, p.y + p.h + 8]], 0.6, 0.5, C.ink3, [1, 2]); line([[mx, my], [p.x - 8, my]], 0.6, 0.5, C.ink3, [1, 2]);
            ctx.globalAlpha = 1; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(mx, my, 5, 0, TAU); ctx.stroke(); dot(mx, my, 1.8, 1, C.ink);
            // axes with handles: N (bottom), D (left), C (right, along the frontier)
            const axisH = (x0, x1, y, at) => { line([[x0, y], [x1, y]], 0.8, 0.7, C.ink2); ctx.globalAlpha = 1; ctx.fillStyle = C.ink; ctx.fillRect(at - 1.5, y - 6, 3, 12); };
            const axisV = (x, y0, y1, at) => { line([[x, y0], [x, y1]], 0.8, 0.7, C.ink2); ctx.globalAlpha = 1; ctx.fillStyle = C.ink; ctx.fillRect(x - 6, at - 1.5, 12, 3); };
            axisH(p.x, p.x + p.w, p.y + p.h + 10, mx); axisV(p.x - 10, p.y, p.y + p.h, my);
            const cy = p.y + p.h - ((cNow - S.C0) / (S.C1 - S.C0)) * p.h; axisV(st.cX, p.y, p.y + p.h, cy);
            for (let k = 0; k <= 4; k++) { const tx = p.x + (k / 4) * p.w, ty = p.y + (k / 4) * p.h; dot(tx, p.y + p.h + 10, 1.2, 0.7, C.ink2); dot(p.x - 10, ty, 1.2, 0.7, C.ink2); dot(st.cX, ty, 1.2, 0.7, C.ink2); }
            // the loss bar: the lower the loss, the taller the bar
            const q = 1 - (loss - lmin) / (lmax - lmin), bh = q * p.h; ctx.globalAlpha = 0.25; ctx.fillStyle = C.ink3; ctx.fillRect(st.lossX - 4, p.y, 8, p.h); ctx.globalAlpha = 0.9; ctx.fillStyle = C.ink; ctx.fillRect(st.lossX - 4, p.y + p.h - bh, 8, bh);
            const fmt = (v, u) => { const e = Math.floor(v), m = 10 ** (v - e); return `${m.toFixed(1)}e${e} ${u}`; };
            label(ctx, C, st, `N = ${fmt(st.n, 'params')}`, mx, p.y + p.h + 22, 'center', true);
            label(ctx, C, st, `D = ${fmt(st.d, 'tokens')}`, p.x - 14, my, 'right', true);
            label(ctx, C, st, `C = 6ND = ${fmt(cNow, 'FLOPs')}`, st.cX - 6, cy - 10, 'right', true);
            label(ctx, C, st, `loss ${loss.toFixed(2)}`, st.lossX, p.y + p.h - bh - 8, 'center', true);
            label(ctx, C, st, 'compute-optimal', fr[Math.floor(fr.length * 0.7)][0] + 6, fr[Math.floor(fr.length * 0.7)][1], 'left');
            label(ctx, C, st, 'drag the point or any axis · C moves along the frontier', p.x, st.vy0 - 6, 'left');
        },
    };

    // An RL environment, learned by policy gradient (REINFORCE with a baseline), batched as in practice:
    // a top-down gridworld (start, goal, pits, walls) and eight agents running episodes at once, all sampling
    // from one shared softmax policy. When the whole batch has finished, the policy takes one gradient step:
    // θ(s,a) += α · (G_t − b) · ∇ log π(a|s), with b the batch's mean return. Arrows show the policy in every
    // cell; a curve tracks the batch's mean return. A click on a cell moves the goal; elsewhere, train more.
    F.rlenv = {
        bleed: true, tall: true, GW: 7, GH: 5, AGENTS: 8, GAMMA: 0.95, ALPHA: 0.8, BETA: 0.1, MAXT: 60, TICK: 0.04,
        title: 'RL environment', note: 'Eight agents, one shared policy, batched REINFORCE updates with a baseline and an entropy bonus; the policy learns to reach the goal.',
        init(R, rand) {
            const fx = R.fx ?? R.x, vy0 = (R.vy0 ?? R.y) + 10, vy1 = (R.vy1 ?? R.y + R.h) - 20, W = R.x + R.w - fx, { GW, GH } = F.rlenv;
            const cell = Math.min((W * 0.56) / GW, (vy1 - vy0) / GH), map = { x: fx + 6, y: vy0 + ((vy1 - vy0) - cell * GH) / 2, c: cell };
            const walls = new Set(['3,0', '3,1', '3,3', '3,4']), pits = new Set(['5,0', '5,4']);   // one gate in the wall; pits in the far corners
            const st = { r: rand(89), fx, vy0, vy1, W, map, walls, pits, start: [0, 2], goal: [6, 2], theta: {}, agents: [], batch: 0, curve: [], todo: 0, last: 0, flash: -1 };
            F.rlenv.newBatch(st);
            return st;
        },
        key: (x, y) => `${x},${y}`,
        pi(st, x, y) { const th = st.theta[F.rlenv.key(x, y)] || [0, 0, 0, 0], m = Math.max(...th), e = th.map((v) => Math.exp(v - m)), s2 = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s2); },
        newBatch(st) { st.agents = Array.from({ length: F.rlenv.AGENTS }, () => ({ x: st.start[0], y: st.start[1], px: st.start[0], py: st.start[1], traj: [], done: false, ret: 0 })); },
        step(st) {
            const { GW, GH, MAXT } = F.rlenv, D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
            st.agents.forEach((ag) => {
                if (ag.done) return;
                const p = F.rlenv.pi(st, ag.x, ag.y); let u = st.r(), a = 0; while (a < 3 && (u -= p[a]) > 0) a++;
                let nx = ag.x + D[a][0], ny = ag.y + D[a][1]; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || st.walls.has(F.rlenv.key(nx, ny))) { nx = ag.x; ny = ag.y; }
                let r = -0.02, end = false; if (nx === st.goal[0] && ny === st.goal[1]) { r = 1; end = true; } else if (st.pits.has(F.rlenv.key(nx, ny))) { r = -1; end = true; }
                ag.traj.push([ag.x, ag.y, a, r]); ag.px = ag.x; ag.py = ag.y; ag.x = nx; ag.y = ny;
                if (end || ag.traj.length >= MAXT) ag.done = true;
            });
            if (st.agents.every((ag) => ag.done)) F.rlenv.update(st);
        },
        // one REINFORCE step on the whole batch: returns-to-go, minus the batch mean return as baseline
        update(st) {
            const { GAMMA, ALPHA } = F.rlenv, rets = st.agents.map((ag) => { let G = 0; const gs = []; for (let k = ag.traj.length - 1; k >= 0; k--) { G = ag.traj[k][3] + GAMMA * G; gs[k] = G; } ag.gs = gs; return gs[0] ?? 0; });
            const b = rets.reduce((a, c) => a + c, 0) / rets.length;
            // plus an entropy bonus (β·∇H), the usual guard against the policy collapsing before it has found the reward
            st.agents.forEach((ag) => ag.traj.forEach(([x, y, a], k) => { const key = F.rlenv.key(x, y), p = F.rlenv.pi(st, x, y), th = st.theta[key] || (st.theta[key] = [0, 0, 0, 0]), adv = ag.gs[k] - b, H = -p.reduce((s2, v) => s2 + v * Math.log(v + 1e-9), 0); for (let j = 0; j < 4; j++) th[j] += ALPHA * (adv * ((j === a ? 1 : 0) - p[j]) - F.rlenv.BETA * p[j] * (Math.log(p[j] + 1e-9) + H)); }));
            st.curve.push(b); if (st.curve.length > 60) st.curve.shift(); st.batch++; st.todo--; st.flash = 0.0001;
            F.rlenv.newBatch(st);
        },
        pointer(type, x, y, st) {
            if (type !== 'up' && type !== 'down') return;
            if (type === 'down') { st.press = [x, y]; return; }
            const m = st.map, cx = Math.floor((x - m.x) / m.c), cy = Math.floor((y - m.y) / m.c), { GW, GH } = F.rlenv, k = F.rlenv.key(cx, cy);
            if (cx >= 0 && cy >= 0 && cx < GW && cy < GH && !st.walls.has(k) && !st.pits.has(k) && !(cx === st.start[0] && cy === st.start[1])) { st.goal = [cx, cy]; F.rlenv.newBatch(st); }
            st.todo = Math.max(st.todo, 0) + 25; st.wake = 40;
        },
        draw(ctx, R, t, C, st, still) {
            const { GW, GH, TICK } = F.rlenv, m = st.map, dot = (x, y, r2, a, col) => { ctx.globalAlpha = a; ctx.fillStyle = col; if (r2 < 1.4) { ctx.fillRect(x - r2, y - r2, 2 * r2, 2 * r2); return; } ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); };
            if (!still && st.todo > 0) { const n = Math.min(6, Math.floor((t - st.last) / TICK)); for (let k = 0; k < n; k++) F.rlenv.step(st); if (n > 0) st.last = t; }
            const u = st.todo > 0 && !still ? Math.min(1, (t - st.last) / TICK) : 1, cxy = (x, y) => [m.x + (x + 0.5) * m.c, m.y + (y + 0.5) * m.c];
            // the grid: walls dense, pits as rings of dots, the goal as a double ring, the start
            for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
                const k = F.rlenv.key(x, y), [px, py] = cxy(x, y);
                ctx.globalAlpha = 0.35; ctx.strokeStyle = C.ink3; ctx.lineWidth = 0.6; ctx.strokeRect(m.x + x * m.c, m.y + y * m.c, m.c, m.c);
                if (st.walls.has(k)) { for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) dot(m.x + x * m.c + (a + 0.5) * (m.c / 4), m.y + y * m.c + (b + 0.5) * (m.c / 4), 1.1, 0.7, C.ink2); continue; }
                if (st.pits.has(k)) { ctx.globalAlpha = 0.8; ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(px, py, m.c * 0.3, 0, TAU); ctx.stroke(); ctx.setLineDash([]); continue; }
                if (x === st.goal[0] && y === st.goal[1]) { ctx.globalAlpha = 1; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(px, py, m.c * 0.32, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(px, py, m.c * 0.14, 0, TAU); ctx.stroke(); continue; }
                // the policy here: an arrow per action, length by probability
                const p = F.rlenv.pi(st, x, y), D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
                p.forEach((v, a) => { const L2 = m.c * 0.42 * v; ctx.globalAlpha = 0.25 + 0.7 * v; ctx.strokeStyle = v > 0.5 ? C.ink : C.ink2; ctx.lineWidth = 0.6 + 1.6 * v; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + D[a][0] * L2, py + D[a][1] * L2); ctx.stroke(); });
                if (x === st.start[0] && y === st.start[1]) { ctx.globalAlpha = 0.9; ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.strokeRect(px - m.c * 0.3, py - m.c * 0.3, m.c * 0.6, m.c * 0.6); }
            }
            // the batch: every agent at once, with its trail this episode
            st.agents.forEach((ag, i) => {
                const off = ((i % 4) - 1.5) * m.c * 0.12, offy = (Math.floor(i / 4) - 0.5) * m.c * 0.14;
                ag.traj.forEach(([x, y]) => { const [px, py] = cxy(x, y); dot(px + off, py + offy, 0.7, 0.25, C.ink3); });
                const [ax, ay] = cxy(ag.px + (ag.x - ag.px) * u, ag.py + (ag.y - ag.py) * u);
                dot(ax + off, ay + offy, 2.4, ag.done ? 0.35 : 1, C.ink);
            });
            // learning curve: the batch's mean return
            const gx = m.x + GW * m.c + 18, gw = st.fx + st.W - 8 - gx, gy0 = m.y, gy1 = m.y + GH * m.c;
            ctx.globalAlpha = 0.5; ctx.strokeStyle = C.ink3; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(gx, gy0); ctx.lineTo(gx, gy1); ctx.lineTo(gx + gw, gy1); ctx.stroke();
            const Y = (v) => gy1 - ((v + 1) / 2) * (gy1 - gy0);
            ctx.globalAlpha = 0.3; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(gx, Y(0)); ctx.lineTo(gx + gw, Y(0)); ctx.stroke(); ctx.setLineDash([]);
            if (st.curve.length > 1) { ctx.globalAlpha = 0.9; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.beginPath(); st.curve.forEach((v, i) => { const x = gx + (i / 59) * gw; i ? ctx.lineTo(x, Y(v)) : ctx.moveTo(x, Y(v)); }); ctx.stroke(); }
            const last = st.curve[st.curve.length - 1];
            label(ctx, C, st, `batch ${st.batch} of 8 episodes`, gx, gy0 - 20, 'left', true);
            label(ctx, C, st, `mean return ${last == null ? '–' : last.toFixed(2)}`, gx, gy0 - 8, 'left');
            label(ctx, C, st, 'θ += α[(G − b)∇log π + β∇H]', gx, gy1 + 12, 'left');
            label(ctx, C, st, 'click a cell: move the goal · click: train 25 batches', m.x, st.vy1 + 12, 'left');
            if (!still && st.todo > 0) st.wake = Math.max(st.wake || 0, 0.3);
        },
    };

    // Sparse attention, trained: a two-layer attention-only transformer (one head per layer, d = 32) learns to continue a
    // repeated sequence: random tokens, then the same tokens again, the repeat 6–10 long so that no fixed offset solves it.
    // Full causal attention finds the circuit known as an induction head: layer 1 attends to the previous token, layer 2
    // from each token to the one that followed its earlier occurrence, and the loss drops from its plateau at once. Each
    // sparse pattern masks both layers; where the induction lag lies outside the mask the model has to route around it
    // through the two layers or fails. Training runs in a worker while the figure is pointed at
    F.attnpat = {
        bleed: true, tall: true, T: 20, V: 16, STEPS: 3000, RATE: 300,
        // the trainer compiled to WebAssembly (tools/induction.ts); the worker falls back to its JavaScript where that fails
        WASM: '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',
        PATTERNS: [
            ['full causal', 'O(n²)', (q, k) => k <= q],
            ['sliding window', 'O(n·w)', (q, k) => k <= q && q - k < 5],
            ['strided (Sparse Transformer)', 'O(n√n)', (q, k) => k <= q && (q - k < 4 || (q - k) % 4 === 0)],
            ['global + window (Longformer)', 'O(n·w)', (q, k) => k <= q && (q - k < 4 || k === 0 || k === 12 || q === 12)],
            ['block-sparse', 'O(n·b)', (q, k) => k <= q && Math.floor(q / 4) - Math.floor(k / 4) <= 1],
            ['random + window + global (BigBird)', 'O(n)', (q, k) => k <= q && (q - k < 3 || k === 0 || ((q * 7 + k * 13) % 11) === 0)],
            ['sinks + window (StreamingLLM)', 'O(n·w)', (q, k) => k <= q && (k < 2 || q - k < 4)],
        ],
        // the worker: forward and backward by hand, Adam, batches of 16 fresh sequences; it posts both layers' attention on
        // the shown sequence, the loss and the share of the repeat predicted correctly
        worker() {
            const T = 20, V = 16, D = 32, DH = 16, L = 2, B = 16, LR = 2e-3, b1 = 0.9, b2 = 0.98, SC = 1 / Math.sqrt(DH);
            // all parameters in one array: E (V×D), Pos (T×D), U (D×V), then per layer Wq, Wk, Wv (D×DH) and Wo (DH×D)
            const oE = 0, oP = oE + V * D, oU = oP + T * D, oL = oU + D * V, LS = 3 * D * DH + DH * D, N = oL + L * LS;
            const th = new Float32Array(N), gr = new Float32Array(N), mo = new Float32Array(N), ve = new Float32Array(N);
            // activations, kept for the backward pass: the residual stream before each layer and after the last, and per layer q, k, v, A, o
            const hs = Array.from({ length: L + 1 }, () => new Float32Array(T * D)), Q = [], Kk = [], Vv = [], AA = [], O = [];
            for (let l = 0; l < L; l++) { Q.push(new Float32Array(T * DH)); Kk.push(new Float32Array(T * DH)); Vv.push(new Float32Array(T * DH)); AA.push(new Float32Array(T * T)); O.push(new Float32Array(T * DH)); }
            const lg = new Float32Array(T * V), dlg = new Float32Array(T * V), dh = new Float32Array(T * D), dn = new Float32Array(T * D), dO = new Float32Array(T * DH), dq = new Float32Array(T * DH), dk = new Float32Array(T * DH), dv = new Float32Array(T * DH), dA = new Float32Array(T), x = new Int32Array(T), perm = new Int32Array(V);
            let wx = null, M = new Uint8Array(T * T), disp = new Int32Array(T), dispS = 8, step = 0, run = false, timer = 0, budget = 0, rate = 300, duty = 1, aL = 0, aA = 0, aN = 0;
            let s0 = 1; const r = () => { s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            const randn = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
            // y (n×b) = x (n×a) · W (a×b), W at offset w in th
            const mm = (X, w, n, a, b, Y) => { Y.fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < a; j++) { const xv = X[i * a + j], wr = w + j * b, yr = i * b; for (let c = 0; c < b; c++) Y[yr + c] += xv * th[wr + c]; } };
            const mmB = (X, w, dY, n, a, b, dX) => { for (let i = 0; i < n; i++) for (let j = 0; j < a; j++) { let s = 0; const xv = X[i * a + j], wr = w + j * b, yr = i * b; for (let c = 0; c < b; c++) { gr[wr + c] += xv * dY[yr + c]; s += dY[yr + c] * th[wr + c]; } if (dX) dX[i * a + j] += s; } };
            // a sequence: S distinct tokens, the same S again, random ones after
            const sample = () => { for (let i = 0; i < V; i++) perm[i] = i; for (let i = V - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = perm[i]; perm[i] = perm[j]; perm[j] = t; } const S = 6 + Math.floor(r() * 5); for (let t = 0; t < T; t++) x[t] = t < S ? perm[t] : t < 2 * S ? perm[t - S] : Math.floor(r() * V); return S; };
            const forward = (S) => {
                const h0 = hs[0]; for (let t = 0; t < T; t++) for (let c = 0; c < D; c++) h0[t * D + c] = th[oE + x[t] * D + c] + th[oP + t * D + c];
                for (let l = 0; l < L; l++) { const h = hs[l], o0 = oL + l * LS, q = Q[l], k = Kk[l], v = Vv[l], A = AA[l], o = O[l], h2 = hs[l + 1];
                    mm(h, o0, T, D, DH, q); mm(h, o0 + D * DH, T, D, DH, k); mm(h, o0 + 2 * D * DH, T, D, DH, v); A.fill(0); o.fill(0);
                    for (let i = 0; i < T; i++) { let mx = -1e30; for (let j = 0; j <= i; j++) if (M[i * T + j]) { let s = 0; for (let c = 0; c < DH; c++) s += q[i * DH + c] * k[j * DH + c]; s *= SC; A[i * T + j] = s; if (s > mx) mx = s; }
                        let z = 0; for (let j = 0; j <= i; j++) if (M[i * T + j]) { const e = Math.exp(A[i * T + j] - mx); A[i * T + j] = e; z += e; }
                        for (let j = 0; j <= i; j++) { const a = (A[i * T + j] /= z || 1); if (a) for (let c = 0; c < DH; c++) o[i * DH + c] += a * v[j * DH + c]; } }
                    mm(o, o0 + 3 * D * DH, T, DH, D, h2); for (let i = 0; i < T * D; i++) h2[i] += h[i]; }
                mm(hs[L], oU, T, D, V, lg); let loss = 0, hit = 0; const t0 = S, t1 = 2 * S - 1; dlg.fill(0);
                for (let t = t0; t < t1; t++) { let mx = -1e30, am = 0; for (let c = 0; c < V; c++) { if (lg[t * V + c] > mx) { mx = lg[t * V + c]; am = c; } } let z = 0; for (let c = 0; c < V; c++) z += Math.exp(lg[t * V + c] - mx);
                    const y = x[t + 1]; loss -= lg[t * V + y] - mx - Math.log(z); hit += am === y ? 1 : 0; for (let c = 0; c < V; c++) dlg[t * V + c] = (Math.exp(lg[t * V + c] - mx) / z - (c === y ? 1 : 0)) / (t1 - t0); }
                return [loss / (t1 - t0), hit / (t1 - t0)];
            };
            const backward = () => {
                dh.fill(0); mmB(hs[L], oU, dlg, T, D, V, dh);
                for (let l = L - 1; l >= 0; l--) { const h = hs[l], o0 = oL + l * LS, q = Q[l], k = Kk[l], v = Vv[l], A = AA[l], o = O[l];
                    dn.set(dh); dO.fill(0); mmB(o, o0 + 3 * D * DH, dh, T, DH, D, dO); dq.fill(0); dk.fill(0); dv.fill(0);
                    for (let i = 0; i < T; i++) { let s2 = 0; for (let j = 0; j <= i; j++) { if (!M[i * T + j]) { dA[j] = 0; continue; } let s = 0; const a = A[i * T + j]; for (let c = 0; c < DH; c++) { s += dO[i * DH + c] * v[j * DH + c]; dv[j * DH + c] += a * dO[i * DH + c]; } dA[j] = s; s2 += s * a; }
                        for (let j = 0; j <= i; j++) { if (!M[i * T + j]) continue; const g = A[i * T + j] * (dA[j] - s2) * SC; for (let c = 0; c < DH; c++) { dq[i * DH + c] += g * k[j * DH + c]; dk[j * DH + c] += g * q[i * DH + c]; } } }
                    mmB(h, o0, dq, T, D, DH, dn); mmB(h, o0 + D * DH, dk, T, D, DH, dn); mmB(h, o0 + 2 * D * DH, dv, T, D, DH, dn); dh.set(dn); }
                for (let t = 0; t < T; t++) for (let c = 0; c < D; c++) { gr[oE + x[t] * D + c] += dh[t * D + c]; gr[oP + t * D + c] += dh[t * D + c]; }
            };
            const train = () => { if (wx) { wx.train(1); return; } gr.fill(0); let ls = 0, ac = 0; for (let b = 0; b < B; b++) { const res = forward(sample()); ls += res[0]; ac += res[1]; backward(); } step++;
                const c1 = 1 / (1 - Math.pow(b1, step)), c2 = 1 / (1 - Math.pow(b2, step));
                for (let i = 0; i < N; i++) { const g = gr[i] / B; mo[i] = b1 * mo[i] + (1 - b1) * g; ve[i] = b2 * ve[i] + (1 - b2) * g * g; th[i] -= LR * (mo[i] * c1) / (Math.sqrt(ve[i] * c2) + 1e-8); }
                aL += ls / B; aA += ac / B; aN++; };
            const post = () => { if (wx) { wx.show(); const A2 = new Float32Array(wx.memory.buffer, wx.attnPtr(), L * T * T), l2 = wx.meanLoss(), a2 = wx.meanAcc(); postMessage({ step: wx.steps(), loss: l2 < 0 ? null : l2, acc: a2 < 0 ? null : a2, A: [Array.from(A2.subarray(0, T * T)), Array.from(A2.subarray(T * T))] }); return; }
                x.set(disp); forward(dispS); postMessage({ step, loss: aN ? aL / aN : null, acc: aN ? aA / aN : null, A: AA.map((a) => Array.from(a)) }); aL = aA = aN = 0; };
            // in slices: at most `rate` steps a second, a frame every 50 ms, resting so the worker uses no more than its duty of a core
            const loop = () => { timer = 0; if (!run || budget <= 0) return; const t0 = Date.now(); let n = 0; while (n < Math.max(1, Math.round(rate * 0.05)) && budget > 0 && Date.now() - t0 < 45) { train(); budget--; n++; } post();
                const used = Date.now() - t0; timer = setTimeout(loop, Math.max(50 - used, used * (1 - duty) / duty)); };
            onmessage = (e) => { const m = e.data;
                if (m.init) { s0 = m.seed | 0; M = Uint8Array.from(m.mask); disp = Int32Array.from(m.disp); dispS = m.S; rate = m.rate; duty = m.duty; budget = m.steps; step = 0; aL = aA = aN = 0; gr.fill(0); mo.fill(0); ve.fill(0);
                    const init = (o, n, s) => { for (let i = 0; i < n; i++) th[o + i] = randn() * s; };
                    init(oE, V * D, 0.5); init(oP, T * D, 0.5); init(oU, D * V, 1 / Math.sqrt(D)); for (let l = 0; l < L; l++) { const o0 = oL + l * LS; init(o0, 3 * D * DH, 1 / Math.sqrt(D)); init(o0 + 3 * D * DH, DH * D, 1 / Math.sqrt(DH)); }
                    wx = null; if (m.wasm && typeof WebAssembly === 'object') try {
                        const bin = Uint8Array.from(atob(m.wasm), (ch) => ch.charCodeAt(0)); wx = new WebAssembly.Instance(new WebAssembly.Module(bin), { env: { abort() {} } }).exports;
                        new Uint8Array(wx.memory.buffer, wx.maskPtr(), T * T).set(M); new Int32Array(wx.memory.buffer, wx.dispPtr(), T).set(disp); wx.setup(m.seed | 0, dispS, LR);
                    } catch (err) { wx = null; }
                    post(); }
                if ('run' in m) run = m.run;
                if (run && !timer) timer = setTimeout(loop, 0); };
        },
        // the shown sequence: eight letters, the same eight again, four more
        sequence() { const p = [...Array(16).keys()]; for (let i = 15; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } const x = p.slice(0, 8).concat(p.slice(0, 8)); while (x.length < 20) x.push(Math.floor(Math.random() * 16)); return x; },
        start(st) {
            F.attnpat.dispose(st); st.hist = []; st.A = null; st.step = 0; st.loss = null; st.acc = null; st.since = performance.now();
            if (typeof Worker === 'undefined' || typeof Blob === 'undefined') return;
            const url = URL.createObjectURL(new Blob([`(${F.attnpat.worker.toString().replace(/^worker\(\)/, 'function ()')})()`], { type: 'text/javascript' }));
            st.worker = new Worker(url); URL.revokeObjectURL(url);
            st.worker.onmessage = (e) => { const m = e.data; st.A = m.A; st.step = m.step; if (m.loss != null) { st.loss = m.loss; st.acc = m.acc; st.hist.push([m.step, m.loss]); } if (m.step >= F.attnpat.STEPS) F.attnpat.dispose(st); st.request?.(); };   // the run complete: no worker kept
            const T = F.attnpat.T, f = F.attnpat.PATTERNS[st.pat][2], mask = []; for (let q = 0; q < T; q++) for (let k = 0; k < T; k++) mask.push(f(q, k) ? 1 : 0);
            st.worker.postMessage({ init: true, wasm: F.attnpat.WASM, seed: 1 + st.pat * 7919, mask, disp: st.seq, S: 8, steps: F.attnpat.STEPS, rate: DEVICE.low ? 100 : F.attnpat.RATE, duty: DEVICE.duty ?? 1, run: !!st.over });
        },
        dispose(st) { if (st.worker) { st.worker.terminate(); st.worker = null; } },
        away(st) { st.worker?.postMessage({ run: false }); },
        back(st) { if (st.over) st.worker?.postMessage({ run: true }); },
        init(R) {
            // the matrix (layer 2) is the main panel; to its right the loss over training and layer 1's matrix, small; the
            // token row a strip of three lines under it, its arcs rising inside the strip
            const fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vy1 = R.vy1 ?? R.y + R.h, W = R.x + R.w - fx, T = F.attnpat.T;
            const fit = K.stack(R, 1, 3).h, pitch = fit >= T * K.LN / 2 ? K.LN / 2 : K.LN / 4, size = T * pitch;
            let size2 = size, lay = K.stack(R, 1, 3, { h: size2 });
            const room = R.x + R.w - K.LN / 2 - (lay.main.x + size2 + K.LN); if (room < 5 * K.LN) { size2 = Math.max(T * 6, size2 - (5 * K.LN - room)); lay = K.stack(R, 1, 3, { h: size2 }); }   // the matrix gives way to the side column
            const fits = R.x + R.w - K.LN / 2 - (lay.main.x + size2 + K.LN) >= 4 * K.LN, sw = fits ? Math.min(7 * K.LN, R.x + R.w - K.LN / 2 - (lay.main.x + size2 + K.LN)) : 0;
            const shift = fits ? K.q(fx + (W - (size2 + K.LN + sw)) / 2) - lay.main.x : 0;   // the group (matrix and side column) centred in the columns
            const rm = lay.main, rt = { ...lay.strip, x: lay.strip.x + shift }, x0 = rm.x + shift, y0 = rm.y, side = fits ? { x: x0 + size2 + K.LN, w: sw } : null;
            return { fx, vy0, vy1, W, strip: rt, mat: { x: x0, y: y0, s: size2 }, side, pat: 0, q: 12, seq: F.attnpat.sequence(), hist: [], step: 0, over: false };
        },
        pointer(type, x, y, st) {
            const m = st.mat, T = F.attnpat.T, cell = m.s / T;
            if (type === 'enter') { st.over = true; if (st.worker) st.worker.postMessage({ run: true }); else if (st.step < F.attnpat.STEPS) F.attnpat.start(st); return; }   // pointed at: it trains
            if (type === 'leave') { st.over = false; st.worker?.postMessage({ run: false }); return; }
            if (type === 'move' && x >= m.x && x <= m.x + m.s && y >= m.y && y <= m.y + m.s) { const q = Math.floor((y - m.y) / cell); if (q !== st.q) { st.q = q; st.wake = 0.3; } }
            if (type === 'up') { st.pat = (st.pat + 1) % F.attnpat.PATTERNS.length; F.attnpat.start(st); st.wake = 0.9; }   // the next mask, trained from scratch
        },
        draw(ctx, R, t, C, st, still) {
            const A = F.attnpat, T = A.T, m = st.mat, cell = m.s / T, f = A.PATTERNS[st.pat][2], LET = 'ABCDEFGHIJKLMNOP';
            // before any training: uniform over what the mask allows
            const att = (l, q, k) => { if (!f(q, k)) return 0; if (st.A) return st.A[l][q * T + k]; let n = 0; for (let j = 0; j <= q; j++) n += f(q, j); return 1 / n; };
            const step = (w) => (w >= 0.25 ? [1, 1] : w >= 0.08 ? [0, 0.5] : [0, 0.25]);
            const matrix = (l, x0, y0, s, small) => { const c = s / T; for (let q = 0; q < T; q++) for (let k = 0; k < T; k++) { const x = x0 + (k + 0.5) * c, y = y0 + (q + 0.5) * c; if (!f(q, k)) { if (!small) K.pt(ctx, C, x, y, -1, 0.25); continue; } const [kk, tone] = step(att(l, q, k)); K.pt(ctx, C, x, y, small ? Math.min(kk, 0) : kk, tone); } };
            matrix(1, m.x, m.y, m.s, false);
            K.line(ctx, C, K.rect(m.x, m.y + st.q * cell, m.s, cell), -1, 1, true);                                   // the selected query's row
            let on = 0; for (let q = 0; q < T; q++) for (let k = 0; k <= q; k++) on += f(q, k);
            const P2 = A.PATTERNS[st.pat];
            label(ctx, C, st, `layer 2 · ${P2[0].replace(/ \(.*\)/, '')} · ${Math.round((on / (T * (T + 1) / 2)) * 100)}%`, m.x, m.y - K.LN / 2, 'left', true);
            label(ctx, C, st, 'keys →', m.x + m.s, m.y + m.s + K.LN / 2, 'right'); label(ctx, C, st, 'queries ↓', m.x - K.LN / 4, m.y + K.LN / 4, 'right');
            // the side column: the loss over training (from ln 16, chance, down), and layer 1
            if (st.side) {
                const sd = st.side, ph = Math.round(m.s * 0.42), px = sd.x, py = m.y, pw = sd.w, top = Math.log(16), n = Math.max(A.STEPS / 2, st.step);
                K.line(ctx, C, [[px, py], [px, py + ph], [px + pw, py + ph]], -1, 0.25);
                if (st.hist.length > 1) K.line(ctx, C, st.hist.map(([s, l]) => [px + (s / n) * pw, py + ph - Math.min(1, l / (top * 1.08)) * ph]), 0, 1);
                label(ctx, C, st, st.loss == null ? 'loss' : `loss ${st.loss.toFixed(2)}`, px, py - K.LN / 2, 'left', true);
                label(ctx, C, st, st.acc == null ? 'step 0' : `${Math.round(st.acc * 100)}% copied · step ${st.step}`, px + pw, py + ph + K.LN / 2, 'right');
                const ms = Math.min(pw, m.s - ph - 2 * K.LN), my = m.y + m.s - ms; if (ms > T * 3) { matrix(0, px, my, ms, true); label(ctx, C, st, 'layer 1', px, my - K.LN / 2, 'left', true); }
            }
            // the token row: letters, the query in focus, an arc to every key it reads in layer 2
            const lx0 = st.strip.x, lx1 = lx0 + st.strip.w, ly = st.strip.y + st.strip.h - K.LN / 4, X = (k) => lx0 + (k / (T - 1)) * (lx1 - lx0);
            for (let k = 0; k < T; k++) { const w = att(1, st.q, k); if (w <= 0.003 || k === st.q) continue; const xa = X(k), xb = X(st.q), h = Math.min(st.strip.h - K.LN, (xb - xa) * 0.55 + K.LN / 4), [kk, tone] = step(w), pts = [];
                for (let i = 0; i <= 24; i++) { const u2 = i / 24, v2 = 1 - u2; pts.push([v2 * v2 * v2 * xb + 3 * v2 * v2 * u2 * xb + 3 * v2 * u2 * u2 * xa + u2 * u2 * u2 * xa, ly - K.LN / 2 - 3 * (v2 * v2 * u2 + v2 * u2 * u2) * h]); }
                K.line(ctx, C, pts, kk - 1, tone); }
            ctx.save(); ctx.font = `10px ${MONO || 'monospace'}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (let k = 0; k < T; k++) { ctx.globalAlpha = k === st.q ? 1 : k < st.q ? 0.5 : 0.25; ctx.fillStyle = k === st.q ? C.ink : C.ink2; ctx.fillText(LET[st.seq[k]], X(k), ly); }
            ctx.restore();
            const nxt = st.q + 1 < T ? LET[st.seq[st.q + 1]] : '';
            label(ctx, C, st, (st.over || st.step ? `query ${st.q + 1} · ${LET[st.seq[st.q]]} → next ${nxt}` : 'point here to train') + (!st.side && st.loss != null ? ` · loss ${st.loss.toFixed(2)}, ${Math.round(st.acc * 100)}% copied` : ''), lx0, ly + K.LN / 2, 'left');
            if (!still && st.since && performance.now() - st.since < 600) st.wake = Math.max(st.wake || 0, 0.2);
        },
    };

    // Continuous control by policy gradient (REINFORCE, Williams), batched, across random arenas of rising level. Each has
    // a start and a goal anywhere (at least 0.55 apart), walls, pits and five reward items, and a route clear of the pits
    // from every start; every batch is a new one, so the agents learn to navigate, not one layout, and the level (more
    // walls and pits, longer detours) rises as they succeed. An agent senses only in its own frame (towards the goal): 12
    // rays reporting how close a wall, a pit and an item it has not yet collected are (exact intersections), the distance
    // to the goal, its last move, and a short memory: how far it got over its last 8 and 32 steps (which keeps it from
    // dithering in a pocket; a position encoding was tried and did not help). It never sees where it is. A small network
    // (44 → 32 tanh → 2, from zero: a random walk) gives the mean of its move in that frame; the move is Gaussian around
    // it (σ). When the batch has finished, one update: REINFORCE through the network, Σ (G_t − b_t)/s · ∂μ/∂θ · (a_t −
    // μ_t)/σ² over the batch (b_t the batch's mean return at step t, s the advantages' spread), by Adam. Rewards: −0.01 a
    // step, a collision −0.02, an item +0.3 (each once an episode), the goal +1, a pit −1, plus potential-based shaping
    // γΦ(s′) − Φ(s) with Φ the distance to the goal around the obstacles (Ng et al.; it keeps the optimal policy; the
    // agents never observe it). The play button starts training (in a worker, at full speed; the arena shows the current
    // policy in a fresh arena each episode); pause stops it and hands the trained policy back, frozen, to try on the arena
    // in front of you: drag the start, the goal, a wall, a pit or an item and its agents run again; a double click gives a
    // new arena at the level. Leaving the figure stops training. The rows set the learning rate, exploration, discount and
    // batch size (σ also while trying it).
    F.rlcont = {
        bleed: true, tall: true, AGENTS: 24, SIGMA: 0.7, ALPHA: 0.003, SPREAD: 0.08, PRE: 0.8, PRE_ALPHA: 0.01, ITEMS: 5, ITEM: 0.3, ITEM_R: 0.02, GOAL_R: 0.045, RAYS: 8, RANGE: 0.2, GAMMA: 0.97, MAXT: 130, SPEED: 0.026, SHAPE: 2, TICK: 0.005, COLLIDE: 0.005, WALLGAP: 0.02, FX: 22, FY: 18, RBF: 0.036, GX: 60, GY: 51, HT: 1,
        title: 'RL in continuous space', note: 'Agents that sense only in their own frame learn to reach a goal past walls and pits, by batched REINFORCE across random arenas of rising level; hover to train, pause to try the policy.',
        init(R, rand) {
            const fx = R.fx ?? R.x, vy0 = (R.vy0 ?? R.y) + 10, vy1 = (R.vy1 ?? R.y + R.h) - 22, W = R.x + R.w - fx, L = K.LN;
            // the arena a square in whole lines; beside it, a line apart, the learning curve over the rows (one line each)
            const a = L * Math.max(6, Math.min(12, Math.floor(Math.min(vy1 - vy0, (W - L) * 0.55) / L))), x0 = K.q(fx + (W - (a + L + Math.min(W - a - L, 9 * L))) / 2), y0 = K.q(vy0 + (vy1 - vy0 - a) / 2);
            const side = { x: x0 + a + L, w: Math.min(W - a - L, 9 * L) }, rowsH = 5 * L;
            const arena = { x: x0, y: y0, s: a }, plot = { x: side.x, y: y0 + L / 2, w: side.w, h: a - rowsH - 1.5 * L }, btn = { x: side.x + L / 4, y: y0, r: L / 2 };
            const st = { r: rand(97), fx, vy0, vy1, W, arena, plot, btn, panel: side, rows: [0, 1, 2, 3, 4].map((i) => ({ y: y0 + a - rowsH + i * L, h: L })), mode: 'play',
                goal: [0.9, F.rlcont.HT / 2], start: [0.07, F.rlcont.HT / 2], walls: [], pits: [], Wm: [], agents: [], batch: 0, curve: [], wins: [], todo: 0, last: 0,
                p: { alpha: F.rlcont.ALPHA, sigma: F.rlcont.SIGMA, gamma: F.rlcont.GAMMA, agents: F.rlcont.AGENTS } };
            F.rlcont.generate(st);
            // a head start: trained quietly while the page opens (PRE seconds, as many batches as fit, at the larger learning
            // rate that learns fastest at first and later turns unstable), then a still of the policy's episode, until hovered
            // its contents wait, unseen, for the arena it will show (the opening, after the head start), then fade in
            const show = () => { st.hidden = false; st.shownAt = performance.now(); st.request?.(); };
            st.hidden = !DEVICE.low; st.show = show; if (DEVICE.low) st.shownAt = performance.now();
            if (!DEVICE.low) idle(() => {
                if (st.disposed || st.mode !== 'play' || st.batch) { show(); return; }
                const base = st.p.alpha; st.p.alpha = F.rlcont.PRE_ALPHA; const spawned = F.rlcont.spawn(st, 1e6); st.p.alpha = base;
                if (spawned) { st.mode = 'train'; st.pre = true; st.preT = setTimeout(() => { if (st.pre) { st.pre = false; st.afterPre = true; F.rlcont.mode(st, 'play'); } }, F.rlcont.PRE * 1000); } else show();
            });
            return st;
        },
        // the opening still: of up to five fresh arenas at the level reached, the one whose episode brings the most agents to
        // the goal (a choice of picture only; training never sees it)
        opening(st) {
            let best = null;
            for (let k = 0; k < (DEVICE.low ? 1 : 5); k++) {
                F.rlcont.generate(st); F.rlcont.rollout(st); const won = st.agents.filter((ag) => ag.won).length;
                if (!best || won > best.won) best = { won, start: st.start, goal: st.goal, walls: st.walls, pits: st.pits, items: st.items, agents: st.agents, lvl: st.arenaLevel };
                if (won >= st.agents.length * 0.75) break;
            }
            Object.assign(st, { start: best.start, goal: best.goal, walls: best.walls, pits: best.pits, items: best.items, agents: best.agents, arenaLevel: best.lvl }); F.rlcont.field(st);
        },
        // one episode of the current policy, run at once, its trails kept (the figure's picture at rest)
        rollout(st) {
            const A = st.arena; F.rlcont.newBatch(st, F.rlcont.AGENTS);
            st.agents.forEach((ag) => { ag.trail = [[A.x + ag.x * A.s, A.y + ag.y * A.s]]; });
            for (let t = 0; t < F.rlcont.MAXT && !st.agents.every((ag) => ag.done); t++) { F.rlcont.step(st, false); st.agents.forEach((ag) => { if (!ag.done || ag.trail.length < 2) ag.trail.push([A.x + ag.x * A.s, A.y + ag.y * A.s]); ag.sx = ag.x; ag.sy = ag.y; ag.px = ag.x; ag.py = ag.y; }); }
        },
        // the fast view: this figure's own methods and constants rebuilt in a worker, which makes a new random arena for
        // every batch and trains at full speed, posting each batch's return, share reaching the goal and the network
        spawn(st, budget = 4000) {
            F.rlcont.dispose(st);
            if (typeof Worker === 'undefined' || typeof Blob === 'undefined') return false;
            const RL = F.rlcont, skip = ['init', 'draw', 'pointer', 'ROWS', 'spawn', 'dispose', 'mode', 'away', 'back', 'opening', 'rollout', 'record'];
            const parts = Object.entries(RL).filter(([k]) => !skip.includes(k)).map(([k, v]) => (typeof v === 'function' ? v.toString() : `${k}: ${JSON.stringify(v)}`));
            const src = `const TAU = Math.PI * 2, DUTY = ${DEVICE.duty}, F = { rlcont: { ${parts.join(',\n')} } }, RL = F.rlcont; let st = null, budget = 0, timer = 0, sent = 0;
                const loop = () => { timer = 0; if (!st || budget <= 0) return; const t0 = Date.now();
                    while (budget > 0 && Date.now() - t0 < 40) { RL.generate(st); const b = st.batch; while (st.batch === b) RL.step(st); budget--;
                        postMessage({ batch: st.batch, level: st.level, ret: st.curve[st.curve.length - 1], won: st.won, net: Date.now() - sent > 100 ? (sent = Date.now(), { W1: Array.from(st.net.W1), W2: Array.from(st.net.W2) }) : null }); }
                    timer = setTimeout(loop, Math.round((Date.now() - t0) * (1 - DUTY) / DUTY)); };   // slices with rests on smaller machines
                onmessage = (e) => { const m = e.data;
                    if (m.init) { let s0 = m.seed >>> 0; const r = () => { s0 = (s0 + 0x6D2B79F5) >>> 0; let t = s0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
                        st = { r, start: [0.07, RL.HT / 2], goal: [0.9, RL.HT / 2], walls: [], pits: [], agents: [], batch: m.batch, level: m.level, atLevel: [], curve: [], todo: 1e9, p: m.p,
                            net: { W1: Float64Array.from(m.net.W1), W2: Float64Array.from(m.net.W2), m: m.net.m.map((a) => Float64Array.from(a)), v: m.net.v.map((a) => Float64Array.from(a)), t: m.net.t } }; }
                    if (m.p && st) st.p = m.p;
                    if (m.more) budget = Math.max(budget, 0) + m.more;
                    if (m.stop) { budget = 0; postMessage({ final: { W1: Array.from(st.net.W1), W2: Array.from(st.net.W2), m: st.net.m.map((a) => Array.from(a)), v: st.net.v.map((a) => Array.from(a)), t: st.net.t, batch: st.batch, level: st.level } }); return; }
                    if (!timer) timer = setTimeout(loop, 0); };`;
            const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
            st.worker = new Worker(url); URL.revokeObjectURL(url);
            st.worker.onmessage = (e) => {
                const m = e.data; st.lastMsg = performance.now();
                if (m.final) { const f = m.final; Object.assign(st.net, { W1: Float64Array.from(f.W1), W2: Float64Array.from(f.W2), m: f.m.map((a) => Float64Array.from(a)), v: f.v.map((a) => Float64Array.from(a)), t: f.t }); st.batch = f.batch; st.level = f.level; F.rlcont.dispose(st); st.handing?.(); return; }
                st.batch = m.batch; st.level = m.level; F.rlcont.record(st, m.ret, m.won);
                if (m.net) { st.net.W1 = Float64Array.from(m.net.W1); st.net.W2 = Float64Array.from(m.net.W2); }
                st.request?.();
            };
            const n = st.net; st.worker.postMessage({ init: true, seed: Math.floor(st.r() * 2 ** 31), batch: st.batch, level: st.level || 0, p: st.p, net: { W1: Array.from(n.W1), W2: Array.from(n.W2), m: n.m.map((a) => Array.from(a)), v: n.v.map((a) => Array.from(a)), t: n.t }, more: budget });
            return true;
        },
        // the run's history: buckets of `span` batches (mean return, share at goal); past 400 buckets neighbours merge and the
        // span doubles, so the plot always shows the whole run at one resolution
        record(st, ret, won) {
            const H = (st.hist = st.hist || []), span = (st.span = st.span || 1), b = H[H.length - 1];
            if (b && b.n < span) { b.r += (ret - b.r) / (b.n + 1); b.w += (won - b.w) / (b.n + 1); b.n++; } else H.push({ r: ret, w: won, n: 1 });
            if (H.length > 400) { const M = []; for (let i = 0; i < H.length; i += 2) { const a = H[i], c = H[i + 1]; if (!c) { M.push(a); continue; } const n = a.n + c.n; M.push({ r: (a.r * a.n + c.r * c.n) / n, w: (a.w * a.n + c.w * c.n) / n, n }); } st.hist = M; st.span = span * 2; }
        },
        dispose(st) { clearTimeout(st.preT); if (st.worker) { st.worker.terminate(); st.worker = null; } },
        // out of sight: training stops at once (no worker left), the episode in flight runs out when it is seen again
        away(st) { clearTimeout(st.preT); st.pre = false; st.afterPre = false; if (st.hidden) { st.hidden = false; st.shownAt = 0; } if (st.worker) { st.worker.terminate(); st.worker = null; } if (st.mode === 'train') { st.mode = 'play'; st.finishing = true; } },
        back() {},
        // a click on the arena: start training (in the worker, across arenas) or stop it and try the trained policy here
        mode(st, to, keep = false) {
            if (to === st.mode) return;
            if (to === 'train') { if (!F.rlcont.spawn(st)) return; st.mode = 'train'; F.rlcont.generate(st); F.rlcont.newBatch(st, F.rlcont.AGENTS); }
            else { st.handing = () => { st.handing = null; st.mode = 'play'; st.played = performance.now(); st.finishing = keep; if (st.afterPre) { st.afterPre = false; st.finishing = true; F.rlcont.opening(st); st.show?.(); } else if (!keep) { F.rlcont.newBatch(st, F.rlcont.AGENTS); st.agents.forEach((ag) => (ag.trail = [])); } st.request?.(); }; if (st.worker) st.worker.postMessage({ stop: true }); else st.handing(); }
        },
        // the level's arena: walls (bars of random orientation), pits and the goal, kept only if a route clear of the pits
        // leads from every start to the goal, as a detour within the level's range (searched on the grid). Each level adds a
        // wall, every second one a pit, and asks for a longer detour; a level crowded past what 400 layouts can satisfy
        // gives its arena from the level below
        LEVELS: 16,
        level(l) { return { walls: [2 + l, 3 + l], pits: 1 + (l >> 1), detour: [1 + 0.03 * l, 1.4 + 0.12 * l] }; },
        generate(st) {
            const r = st.r, { GX } = F.rlcont, HT = F.rlcont.HT;
            for (let l = st.level || 0; l >= 0; l--) {
                const L = F.rlcont.level(l);
                for (let tries = 0; tries < 400; tries++) {
                    st.walls = []; st.pits = [];
                    const nw = L.walls[0] + Math.floor(r() * (L.walls[1] - L.walls[0] + 1));
                    st.start = [0.1 + r() * 0.8, 0.1 + r() * (HT - 0.2)];
                    do { st.goal = [0.08 + r() * 0.84, 0.08 + r() * (HT - 0.16)]; } while (Math.hypot(st.goal[0] - st.start[0], st.goal[1] - st.start[1]) < 0.55);
                    // one thing at a time, each drawn again until it fits: walls clear of the start's disc and the goal, pits clear
                    // of the walls, the start and the goal
                    const nearWall = (x, y, m) => st.walls.some(([x0, y0, x1, y1]) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m);
                    for (let k = 0, q = 0; k < nw && q < 200; q++) {
                        const vert = r() < 0.5, x = 0.05 + r() * 0.9, y = r() * HT, L2 = 0.14 + r() * 0.18, t2 = 0.035;
                        const w = vert ? [x - t2 / 2, Math.max(0, y - L2 / 2), x + t2 / 2, Math.min(HT, y + L2 / 2)] : [Math.max(0, x - L2 / 2), y - t2 / 2, Math.min(1, x + L2 / 2), y + t2 / 2];
                        const hits = (px, py, m) => px > w[0] - m && px < w[2] + m && py > w[1] - m && py < w[3] + m;
                        if (hits(...st.start, F.rlcont.SPREAD + 0.02) || hits(...st.goal, F.rlcont.GOAL_R + 0.02)) continue;
                        st.walls.push(w); k++;
                    }
                    for (let k = 0, q = 0; k < L.pits && q < 200; q++) {
                        const pp = [0.08 + r() * 0.84, 0.08 + r() * (HT - 0.16)];
                        if (nearWall(...pp, 0.06) || Math.hypot(pp[0] - st.goal[0], pp[1] - st.goal[1]) < 0.14 || Math.hypot(pp[0] - st.start[0], pp[1] - st.start[1]) < 0.16 || st.pits.some(([px, py]) => Math.hypot(px - pp[0], py - pp[1]) < 0.12)) continue;
                        st.pits.push(pp); k++;
                    }
                    const d = F.rlcont.bfs(st, 0.1), at = (x, y) => d[Math.floor((y / HT) * F.rlcont.GY) * GX + Math.floor(x * GX)];
                    const straight = Math.hypot(st.goal[0] - st.start[0], st.goal[1] - st.start[1]), safe = at(st.start[0], st.start[1]);
                    if (!isFinite(safe) || safe < straight * L.detour[0] || safe > straight * L.detour[1]) continue;              // a real detour, not a maze
                    if (![0, 1, 2, 3, 4, 5].every((q) => { const x = st.start[0] + F.rlcont.SPREAD * Math.cos(q * TAU / 6), y = st.start[1] + F.rlcont.SPREAD * Math.sin(q * TAU / 6); return isFinite(at(x, y)); })) continue;   // every start has a way
                    // reward items: where a route reaches, clear of the pits, the goal and each other
                    st.items = [];
                    for (let k = 0, q = 0; k < F.rlcont.ITEMS && q < 300; q++) { const x = 0.05 + r() * 0.9, y = 0.05 + r() * (HT - 0.1); if (!isFinite(at(x, y)) || st.pits.some(([px, py]) => Math.hypot(x - px, y - py) < 0.1) || Math.hypot(x - st.goal[0], y - st.goal[1]) < 0.12 || st.items.some(([ix, iy]) => Math.hypot(x - ix, y - iy) < 0.12)) continue; st.items.push([x, y]); k++; }
                    st.arenaLevel = l; l = -1; break;
                }
            }
            F.rlcont.field(st);
            if (!st.net) F.rlcont.netInit(st);
            F.rlcont.newBatch(st);
        },
        // breadth-first distances on a fine grid, from the goal, through free cells clear of pits by `margin`
        bfs(st, margin) {
            const { GX, GY } = F.rlcont, HT = F.rlcont.HT, N = GX * GY;
            // cells near a wall stay passable but cost more, so the field bends smoothly away from walls instead of
            // falling off a cliff beside them (Dijkstra on the grid, its heap in typed arrays)
            const g = F.rlcont.WALLGAP, free = new Uint8Array(N), cost = new Float64Array(N);
            for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
                const x = (i + 0.5) / GX, y = ((j + 0.5) / GY) * HT, k = j * GX + i; let blocked = false, near = false;
                for (const [x0, y0, x1, y1] of st.walls) { if (x > x0 && x < x1 && y > y0 && y < y1) { blocked = true; break; } if (x > x0 - g && x < x1 + g && y > y0 - g && y < y1 + g) near = true; }
                if (!blocked) for (const [px, py] of st.pits) if ((x - px) ** 2 + (y - py) ** 2 < margin * margin) { blocked = true; break; }
                free[k] = blocked ? 0 : 1; cost[k] = near ? 1.3 : 1;
            }
            const dist = new Float64Array(N).fill(Infinity), done = new Uint8Array(N), hk = new Float64Array(8 * N + 8), hv = new Int32Array(8 * N + 8); let hn = 0;
            const push = (d, v) => { let c = hn++; while (c > 0) { const p = (c - 1) >> 1; if (hk[p] <= d) break; hk[c] = hk[p]; hv[c] = hv[p]; c = p; } hk[c] = d; hv[c] = v; };
            const pop = () => { const v = hv[0], d = hk[--hn], lv = hv[hn]; let c = 0; for (;;) { const l = 2 * c + 1; if (l >= hn) break; const m = l + 1 < hn && hk[l + 1] < hk[l] ? l + 1 : l; if (hk[m] >= d) break; hk[c] = hk[m]; hv[c] = hv[m]; c = m; } hk[c] = d; hv[c] = lv; return v; };
            const gi = Math.min(GX - 1, Math.floor(st.goal[0] * GX)), gj = Math.min(GY - 1, Math.floor((st.goal[1] / HT) * GY)), g0 = gj * GX + gi;
            dist[g0] = 0; push(0, g0);
            const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1], DC = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
            while (hn) {
                const k = pop(); if (done[k]) continue; done[k] = 1; const i = k % GX, j = (k - i) / GX, d = dist[k];
                for (let q = 0; q < 8; q++) { const a2 = i + DI[q], b2 = j + DJ[q]; if (a2 < 0 || b2 < 0 || a2 >= GX || b2 >= GY) continue; const k2 = b2 * GX + a2; if (!free[k2] || done[k2]) continue; const nd = d + (DC[q] * (cost[k] + cost[k2])) / 2 / GX; if (nd < dist[k2] - 1e-9) { dist[k2] = nd; push(nd, k2); } }
            }
            return dist;
        },
        field(st) { st.dist = F.rlcont.bfs(st, 0.055); },
        geo(st, x, y) { const { GX, GY } = F.rlcont, i = Math.max(0, Math.min(GX - 1, Math.floor(x * GX))), j = Math.max(0, Math.min(GY - 1, Math.floor((y / F.rlcont.HT) * GY))), d = st.dist[j * GX + i]; if (isFinite(d)) return d; let b = Infinity; for (let r = 1; r < 6 && !isFinite(b); r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const a2 = i + di, b2 = j + dj; if (a2 >= 0 && b2 >= 0 && a2 < GX && b2 < GY) b = Math.min(b, st.dist[b2 * GX + a2] + Math.hypot(di, dj) / GX); } return isFinite(b) ? b : 3; },
        g(st) { let u = 0, v = 0; while (!u) u = st.r(); while (!v) v = st.r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); },
        // what the agent senses, in its own frame (e₁ towards the goal, e₂ to its left): 12 rays at fixed angles from e₁,
        // each the proximity (1 − distance/range) of a wall and of a pit; the distance to the goal; its last move in this
        // frame; and a constant. It never sees where it is
        OBS: 12 * 3 + 4 + 4, HID: 32,
        frame(st, x, y) { const gx = st.goal[0] - x, gy = st.goal[1] - y, d = Math.hypot(gx, gy) || 1e-9; return [gx / d, gy / d, d]; },
        obs(st, ag) {
            const { RANGE } = F.rlcont, K2 = 12, [ex, ey, d] = F.rlcont.frame(st, ag.x, ag.y), o = new Float64Array(F.rlcont.OBS);
            for (let k = 0; k < K2; k++) {
                const an = (k / K2) * TAU, c = Math.cos(an), s2 = Math.sin(an), cx = c * ex - s2 * ey, cy = c * ey + s2 * ex;
                // exact distances along the ray: to the arena's edge and each wall (slabs), to each pit's disc
                const ix = 1 / (cx || 1e-12), iy = 1 / (cy || 1e-12);
                let dw = Math.min(cx > 0 ? (1 - ag.x) * ix : -ag.x * ix, cy > 0 ? (F.rlcont.HT - ag.y) * iy : -ag.y * iy), dp = Infinity;
                for (const [x0, y0, x1, y1] of st.walls) { const ta = (x0 - ag.x) * ix, tb = (x1 - ag.x) * ix, tc = (y0 - ag.y) * iy, td = (y1 - ag.y) * iy, t0 = Math.max(Math.min(ta, tb), Math.min(tc, td)), t1 = Math.min(Math.max(ta, tb), Math.max(tc, td)); if (t1 >= Math.max(t0, 0) && t0 < dw) dw = Math.max(t0, 0); }
                const disc = (qx, qy, rr) => { const fx = ag.x - qx, fy = ag.y - qy, b = fx * cx + fy * cy, q = fx * fx + fy * fy - rr * rr, dd = b * b - q; if (dd < 0) return Infinity; const sq2 = Math.sqrt(dd); return -b + sq2 < 0 ? Infinity : Math.max(-b - sq2, 0); };   // a disc behind the agent (both crossings behind) is not seen
                for (const [qx, qy] of st.pits) dp = Math.min(dp, disc(qx, qy, 0.05));
                let di = Infinity; (st.items || []).forEach(([qx, qy], i) => { if (!(ag.got & (1 << i))) di = Math.min(di, disc(qx, qy, F.rlcont.ITEM_R)); });
                o[k] = dw < RANGE ? 1 - dw / RANGE : 0; o[K2 + k] = dp < RANGE ? 1 - dp / RANGE : 0; o[2 * K2 + k] = di < 2 * RANGE ? 1 - di / (2 * RANGE) : 0;
            }
            o[3 * K2] = Math.min(1.5, d); o[3 * K2 + 1] = ag.vf ? ag.vf[0] : 0; o[3 * K2 + 2] = ag.vf ? ag.vf[1] : 0; o[3 * K2 + 3] = 1;
            // a short memory: how far it got over its last 8 and 32 steps, in its frame (stuck in a pocket, both stay small)
            const b0 = 3 * K2 + 4, h = ag.hist || [];
            [[8, 5], [32, 2]].forEach(([n, sc], i) => { const old = h.length ? h[Math.max(0, h.length - n)] : [ag.x, ag.y], mx = (ag.x - old[0]) * sc, my = (ag.y - old[1]) * sc; o[b0 + 2 * i] = mx * ex + my * ey; o[b0 + 2 * i + 1] = -mx * ey + my * ex; });
            return { o, ex, ey };
        },
        // the policy's mean move (in the agent's frame): μ = W₂ tanh(W₁ o) + b₂, starting from zero (a random walk)
        netInit(st) {
            const { OBS, HID } = F.rlcont, g = () => F.rlcont.g(st), n1 = OBS * HID, n2 = 2 * HID + 2;
            const W1 = new Float64Array(n1), W2 = new Float64Array(n2); for (let i = 0; i < n1; i++) W1[i] = g() / Math.sqrt(OBS);
            st.net = { W1, W2, m: [new Float64Array(n1), new Float64Array(n2)], v: [new Float64Array(n1), new Float64Array(n2)], t: 0 };
        },
        forward(st, o) {
            const { OBS, HID } = F.rlcont, { W1, W2 } = st.net, h = new Float64Array(HID);
            for (let j = 0; j < HID; j++) { let q = 0; const row = j * OBS; for (let k = 0; k < OBS; k++) q += W1[row + k] * o[k]; h[j] = Math.tanh(q); }
            let m0 = W2[2 * HID], m1 = W2[2 * HID + 1]; for (let j = 0; j < HID; j++) { m0 += W2[j] * h[j]; m1 += W2[HID + j] * h[j]; }
            return { h, m: [m0, m1] };
        },
        newBatch(st, n) { st.agents = Array.from({ length: n || (st.p ? st.p.agents : F.rlcont.AGENTS) }, () => { let x, y, k = 0; do { const an = st.r() * TAU, rr = F.rlcont.SPREAD * Math.sqrt(st.r()); x = st.start[0] + rr * Math.cos(an); y = st.start[1] + rr * Math.sin(an); k++; } while (k < 20 && (F.rlcont.blocked(st, x, y) || st.pits.some(([px, py]) => Math.hypot(x - px, y - py) < 0.08))); return { x, y, px: x, py: y, traj: [], done: false, got: 0, hist: [] }; }); },
        // does the segment touch a wall or leave the arena? exact (Liang–Barsky against each wall), so no corner is skipped
        crosses(st, x0, y0, x1, y1) {
            if (F.rlcont.blocked(st, x1, y1)) return true;
            const dx = x1 - x0, dy = y1 - y0;
            return st.walls.some(([a0, b0, a1, b1]) => { let t0 = 0, t1 = 1; for (const [p, q] of [[-dx, x0 - a0], [dx, a1 - x0], [-dy, y0 - b0], [dy, b1 - y0]]) { if (p === 0) { if (q <= 0) return false; continue; } const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } } return t0 < t1; });
        },
        blocked(st, x, y) { if (x < 0 || x > 1 || y < 0 || y > F.rlcont.HT) return true; return st.walls.some(([x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1); },
        step(st, learn = true) {
            const { SPEED, MAXT } = F.rlcont, SIGMA = st.p ? st.p.sigma : F.rlcont.SIGMA, GAMMA = st.p ? st.p.gamma : F.rlcont.GAMMA;
            st.agents.forEach((ag) => {
                if (ag.done) return;
                const { o, ex, ey } = F.rlcont.obs(st, ag), { h, m } = F.rlcont.forward(st, o), a = [m[0] + SIGMA * F.rlcont.g(st), m[1] + SIGMA * F.rlcont.g(st)];
                const n = Math.hypot(a[0], a[1]), k = n > 1.5 ? 1.5 / n : 1, wx = (a[0] * ex - a[1] * ey) * k, wy = (a[0] * ey + a[1] * ex) * k, nx = ag.x + wx * SPEED, ny = ag.y + wy * SPEED;
                ag.vf = [a[0] * k, a[1] * k]; (ag.hist = ag.hist || []).push([ag.x, ag.y]); if (ag.hist.length > 32) ag.hist.shift();
                // collisions slide along walls: keep whichever part of the move is free
                // collisions along the whole step (steps are longer than walls are thick): slide along a wall, or stop
                const clear = (x0, y0, x1, y1) => !F.rlcont.crosses(st, x0, y0, x1, y1);
                ag.px = ag.x; ag.py = ag.y; let hit = false;
                if (clear(ag.x, ag.y, nx, ny)) { ag.x = nx; ag.y = ny; } else { hit = true; if (clear(ag.x, ag.y, nx, ag.y)) ag.x = nx; else if (clear(ag.x, ag.y, ag.x, ny)) ag.y = ny; }
                // potential-based shaping (Ng et al.): γΦ(s′) − Φ(s) with Φ = −distance to the goal; it leaves the optimal policy unchanged
                const Phi = (x, y) => -F.rlcont.geo(st, x, y) * F.rlcont.SHAPE;                   // distance around the obstacles
                let r = -0.01 - (hit ? F.rlcont.COLLIDE : 0) + GAMMA * Phi(ag.x, ag.y) - Phi(ag.px, ag.py), end = false;
                (st.items || []).forEach(([qx, qy], i) => { if (!(ag.got & (1 << i)) && Math.hypot(ag.x - qx, ag.y - qy) < F.rlcont.ITEM_R) { ag.got |= 1 << i; r += F.rlcont.ITEM; } });   // a reward item, once each an episode
                if (Math.hypot(ag.x - st.goal[0], ag.y - st.goal[1]) < F.rlcont.GOAL_R) { r = 1; end = true; }
                else if (st.pits.some(([px, py]) => Math.hypot(ag.x - px, ag.y - py) < 0.05)) { r = -1; end = true; }
                if (learn) ag.traj.push({ o, h, m, a, r }); ag.t = (ag.t || 0) + 1; ag.won = end && r === 1; if (end || ag.t >= MAXT) ag.done = true;
            });
            if (learn && st.agents.every((ag) => ag.done)) F.rlcont.update(st);
        },
        // REINFORCE through the network: ∇ = Σ (G_t − b_t)/s · ∂μ/∂θ · (a_t − μ_t)/σ², averaged over the batch, by Adam
        update(st) {
            const { OBS, HID } = F.rlcont, P = st.p || {}, GAMMA = P.gamma ?? F.rlcont.GAMMA, ALPHA = P.alpha ?? F.rlcont.ALPHA, SIGMA = P.sigma ?? F.rlcont.SIGMA, Tm = Math.max(...st.agents.map((ag) => ag.traj.length));
            st.agents.forEach((ag) => { let G = 0; for (let t = ag.traj.length - 1; t >= 0; t--) { G = ag.traj[t].r + GAMMA * G; ag.traj[t].G = G; } });
            const base = Array.from({ length: Tm }, (_, t) => { const xs = st.agents.filter((ag) => ag.traj.length > t).map((ag) => ag.traj[t].G); return xs.reduce((a, b) => a + b, 0) / xs.length; });
            const n = st.agents.length;
            // advantages normalised by their spread across the batch (standard practice; keeps the step size steady)
            let ss = 0, cnt = 0; st.agents.forEach((ag) => ag.traj.forEach((s2, t) => { ss += (s2.G - base[t]) ** 2; cnt++; })); const sd = Math.sqrt(ss / Math.max(1, cnt)) || 1;
            const net = st.net, g1 = new Float64Array(net.W1.length), g2 = new Float64Array(net.W2.length);
            st.agents.forEach((ag) => ag.traj.forEach((s2, t) => {
                const adv = (s2.G - base[t]) / sd, d0 = (adv * (s2.a[0] - s2.m[0])) / (SIGMA * SIGMA), d1 = (adv * (s2.a[1] - s2.m[1])) / (SIGMA * SIGMA), h = s2.h, o = s2.o;
                g2[2 * HID] += d0; g2[2 * HID + 1] += d1;
                for (let j = 0; j < HID; j++) {
                    g2[j] += d0 * h[j]; g2[HID + j] += d1 * h[j];
                    const dz = (d0 * net.W2[j] + d1 * net.W2[HID + j]) * (1 - h[j] * h[j]), row = j * OBS; if (!dz) continue;
                    for (let k = 0; k < OBS; k++) g1[row + k] += dz * o[k];
                }
            }));
            // Adam (ascent), β = 0.9, 0.999
            net.t++; const b1 = 0.9, b2 = 0.999, c1 = 1 - b1 ** net.t, c2 = 1 - b2 ** net.t;
            [[net.W1, g1, 0], [net.W2, g2, 1]].forEach(([Wp, gp, i]) => { const m = net.m[i], v = net.v[i]; for (let k = 0; k < Wp.length; k++) { const gk = gp[k] / n; m[k] = b1 * m[k] + (1 - b1) * gk; v[k] = b2 * v[k] + (1 - b2) * gk * gk; Wp[k] += ALPHA * (m[k] / c1) / (Math.sqrt(v[k] / c2) + 1e-8); } });
            const mean = st.agents.reduce((a, ag) => a + ag.traj[0].G, 0) / n;
            st.won = st.agents.filter((ag) => ag.won).length / n; (st.wins = st.wins || []).push(st.won);
            (st.atLevel = st.atLevel || []).push(st.won); if (st.atLevel.length > 60) st.atLevel.shift(); const rec = (k) => st.atLevel.slice(-k).reduce((x, y) => x + y, 0) / k;
            if (st.atLevel.length >= 15 && rec(15) >= 0.7 && (st.level || 0) < F.rlcont.LEVELS) { st.level = (st.level || 0) + 1; st.atLevel = []; }
            else if (st.atLevel.length >= 30 && rec(30) < 0.15 && st.level > 0) { st.level--; st.atLevel = []; }
            st.curve.push(mean); if (st.curve.length > 8) { st.curve.shift(); st.wins.shift(); } st.batch++; st.todo--;
            F.rlcont.newBatch(st);
        },
        // the rows: what each sets, its range, and how it reads
        ROWS: [['alpha', 'learning rate', [0.0005, 0.05], true, (v) => v.toPrecision(2)], ['sigma', 'exploration', [0.1, 1.5], false, (v) => v.toFixed(2)],
            ['gamma', 'discount', [0.8, 0.999], false, (v) => v.toFixed(3)], ['agents', 'batch', [4, 64], true, (v) => `${Math.round(v)} agents`]],
        // drag a row to set it (the worker takes it from its next batch); drag the goal, a pit or a wall to move it (the
        // policy trains on in the changed arena); double click the arena for a new one
        pointer(type, x, y, st) {
            const A = st.arena, ux = (x - A.x) / A.s, uy = (y - A.y) / A.s, inA = ux > 0 && ux < 1 && uy > 0 && uy < F.rlcont.HT, pn = st.panel, play = st.mode === 'play';
            st.played = performance.now();   // handled: the agents keep moving for a while
            if (type === 'leave') { if (st.mode === 'train') F.rlcont.mode(st, 'play', true); else st.finishing = true; return; }   // out of the figure: training stops, the episode runs out
            if (type === 'enter') { st.finishing = false; if (st.pre) { st.pre = false; clearTimeout(st.preT); st.worker?.postMessage({ more: 4000, p: st.p }); } if (st.hidden) st.show?.(); F.rlcont.mode(st, 'train'); st.wake = 6; return; }   // on it: training (again)
            if (type === 'down') st.finishing = false;
            const onBtn = Math.hypot(x - st.btn.x, y - st.btn.y) < st.btn.r + 4;
            if (type === 'down' && onBtn) { F.rlcont.mode(st, play ? 'train' : 'play'); st.wake = 6; st.row = -1; st.grab = null; st.downAt = null; return; }
            if (type === 'down') {
                st.moved = false; st.grab = null; st.row = st.rows.slice(0, 4).findIndex((r) => y >= r.y && y < r.y + r.h && x >= pn.x - 10 && x <= pn.x + pn.w + 10);
                if (st.row < 0 && inA && play) {
                    const ii = (st.items || []).findIndex(([qx, qy]) => Math.hypot(ux - qx, uy - qy) < 0.04);
                    if (Math.hypot(ux - st.goal[0], uy - st.goal[1]) < 0.08) st.grab = { kind: 'goal' };
                    else if (Math.hypot(ux - st.start[0], uy - st.start[1]) < F.rlcont.SPREAD) st.grab = { kind: 'start' };
                    else if (ii >= 0) st.grab = { kind: 'item', i: ii };
                    else { const pi = st.pits.findIndex(([px, py]) => Math.hypot(ux - px, uy - py) < 0.065); if (pi >= 0) st.grab = { kind: 'pit', i: pi }; else { const wi = st.walls.findIndex(([x0, y0, x1, y1]) => ux > x0 - 0.015 && ux < x1 + 0.015 && uy > y0 - 0.015 && uy < y1 + 0.015); if (wi >= 0) st.grab = { kind: 'wall', i: wi }; } }
                    if (st.grab) { const g = st.grab, o = g.kind === 'goal' ? st.goal : g.kind === 'start' ? st.start : g.kind === 'pit' ? st.pits[g.i] : g.kind === 'item' ? st.items[g.i] : st.walls[g.i]; g.off = [o[0] - ux, o[1] - uy]; g.at = [ux, uy]; }   // held where it was grabbed
                }
                st.downAt = [x, y];
            }
            if (st.row >= 0 && (type === 'down' || type === 'move')) {
                const [key, , [lo, hi], log] = F.rlcont.ROWS[st.row], k = Math.max(0, Math.min(1, (x - pn.x) / pn.w)), v = log ? lo * (hi / lo) ** k : lo + k * (hi - lo);
                st.p[key] = key === 'agents' ? Math.round(v) : v; if (st.worker) st.worker.postMessage({ p: st.p }); st.wake = 1; return;
            }
            // the thing follows the pointer from where it was grabbed; a place it may not go is skipped (it waits, then
            // catches up), so it never drifts from the pointer: the goal not in a wall or a pit, a pit not on the goal or
            // the start, a wall not over either, an item not in a wall
            if (type === 'move' && st.grab) {
                const g = st.grab, HT = F.rlcont.HT, cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), nx = ux + g.off[0], ny = uy + g.off[1];
                const onPit = (x2, y2, m) => st.pits.some(([px, py], i) => (g.kind !== 'pit' || i !== g.i) && Math.hypot(x2 - px, y2 - py) < m);
                if (g.kind === 'goal') { const q = [cl(nx, 0.04, 0.96), cl(ny, 0.04, HT - 0.04)]; if (!F.rlcont.blocked(st, ...q) && !onPit(...q, 0.07)) st.goal = q; }
                else if (g.kind === 'start') { const q = [cl(nx, 0.06, 0.94), cl(ny, 0.06, HT - 0.06)]; if (!F.rlcont.blocked(st, ...q) && !onPit(...q, 0.09)) st.start = q; }
                else if (g.kind === 'item') { const q = [cl(nx, 0.03, 0.97), cl(ny, 0.03, HT - 0.03)]; if (!F.rlcont.blocked(st, ...q)) st.items[g.i] = q; }
                else if (g.kind === 'pit') { const q = [cl(nx, 0.05, 0.95), cl(ny, 0.05, HT - 0.05)]; if (Math.hypot(q[0] - st.goal[0], q[1] - st.goal[1]) > 0.07 && Math.hypot(q[0] - st.start[0], q[1] - st.start[1]) > 0.09) st.pits[g.i] = q; }
                else { const [x0, y0, x1, y1] = st.walls[g.i], w2 = x1 - x0, h2 = y1 - y0, qx = cl(nx, 0, 1 - w2), qy = cl(ny, 0, HT - h2), w = [qx, qy, qx + w2, qy + h2], over = (p2) => p2[0] > w[0] && p2[0] < w[2] && p2[1] > w[1] && p2[1] < w[3]; if (!over(st.goal) && !over(st.start)) st.walls[g.i] = w; }
                if (Math.hypot(ux - g.at[0], uy - g.at[1]) > 0.002) st.moved = true; st.wake = 4; return;
            }
            if (type !== 'up') return;
            if (st.row >= 0) { st.row = -1; return; }
            if (st.grab) { const moved = st.moved, kind = st.grab.kind; st.grab = null; if (moved) { F.rlcont.field(st); if (kind === 'start') { F.rlcont.newBatch(st, F.rlcont.AGENTS); st.agents.forEach((ag) => (ag.trail = [])); } st.wake = 6; return; } }   // the agents run on in the changed arena
            if (!inA || (st.downAt && Math.hypot(x - st.downAt[0], y - st.downAt[1]) > 6)) return;
            // a double click while trying it: a new arena at this level
            const now = performance.now(), dbl = st.lastClick && now - st.lastClick < 320; st.lastClick = dbl ? 0 : now;
            if (dbl) { F.rlcont.generate(st); F.rlcont.newBatch(st, F.rlcont.AGENTS); st.agents.forEach((ag) => (ag.trail = [])); st.played = performance.now(); st.wake = 6; }   // a new arena, training or paused
        },
        draw(ctx, R, t, C, st, still) {
            const { TICK } = F.rlcont, A = st.arena, P = (x, y) => [A.x + x * A.s, A.y + y * A.s];
            // the agents shown are the batch being trained: a step per tick while there is training to do, the update when the
            // whole batch has finished
            const train = st.mode === 'train', live = !still && (train ? performance.now() - (st.lastMsg || 0) < 3000 : performance.now() - (st.played || 0) < 12000);
            const ended = st.finishing && !train && st.agents.every((ag) => ag.done), go = live && !ended;
            if (go) { const k = Math.min(12, Math.floor((t - st.last) / TICK)); for (let i = 0; i < k; i++) { if (st.agents.every((ag) => ag.done)) { if (st.finishing && !train) break; if (train) F.rlcont.generate(st); F.rlcont.newBatch(st, F.rlcont.AGENTS); st.agents.forEach((ag) => (ag.trail = [])); } F.rlcont.step(st, false); } if (k > 0) st.last = t; } else st.last = t;
            const u = go ? Math.min(1, (t - st.last) / TICK) : 1;
            // the arena and its obstacles in outline: the arena, each wall a closed line (u/2, context tone), each pit a ring
            // (u/2); the goal two rings (u, focus), the start a dotted ring, the items small discs
            const HT = F.rlcont.HT;
            K.line(ctx, C, K.rect(A.x, A.y, A.s, A.s * HT), -1, 0.5, true);
            const fadeIn = st.hidden ? 0 : Math.min(1, (performance.now() - (st.shownAt || 0)) / (4 * K.TB * 1000));
            // the fade runs on frames of its own: an untouched figure is otherwise drawn only when asked
            K.fade = K.ease(fadeIn); if (fadeIn < 1 && !st.hidden) { st.wake = Math.max(st.wake || 0, 0.1); requestAnimationFrame(() => st.request?.()); }
            st.walls.forEach(([x0, y0, x1, y1]) => { const [X0, Y0] = P(x0, y0), [X1, Y1] = P(x1, y1); K.line(ctx, C, K.rect(X0, Y0, X1 - X0, Y1 - Y0), -1, 0.5, true); });
            st.pits.forEach(([px, py]) => { const [X, Y] = P(px, py); K.line(ctx, C, K.circle(X, Y, 0.05 * A.s), -1, 0.5, true); });
            // the goal and the items drawn at the size they are reached at
            { const [X, Y] = P(...st.goal); K.line(ctx, C, K.circle(X, Y, F.rlcont.GOAL_R * A.s), 0, 1, true); K.line(ctx, C, K.circle(X, Y, 4 * K.U), 0, 1, true); }
            (st.items || []).forEach(([qx, qy]) => { const [X, Y] = P(qx, qy); ctx.globalAlpha = 0.5 * K.fade; ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(X, Y, F.rlcont.ITEM_R * A.s, 0, TAU); ctx.fill(); });
            { const [X, Y] = P(...st.start), ring = K.circle(X, Y, F.rlcont.SPREAD * A.s); K.dotted(ctx, C, ring.concat([ring[0]]), -1, 0.5); }   // where the agents start
            { const kf = K.fade; K.fade = 1;   // the button is the panel's, never faded
            { const cx = st.btn.x, cy = st.btn.y, u5 = 4 * K.U;
              if (train) { K.line(ctx, C, [[cx - u5 / 2, cy - u5], [cx - u5 / 2, cy + u5]], 1, 1); K.line(ctx, C, [[cx + u5 / 2, cy - u5], [cx + u5 / 2, cy + u5]], 1, 1); }
              else K.line(ctx, C, [[cx - u5 * 0.8, cy - u5], [cx + u5, cy], [cx - u5 * 0.8, cy + u5]], 0, 1, true); } K.fade = kf; }
            // the agents: data points in focus tone (context once their episode ends), trails as lines at context tone
            st.agents.forEach((ag) => {
                const tx = ag.px + (ag.x - ag.px) * u, ty = ag.py + (ag.y - ag.py) * u; if (ag.sx == null || still) { ag.sx = tx; ag.sy = ty; } else { ag.sx += (tx - ag.sx) * 0.3; ag.sy += (ty - ag.sy) * 0.3; }
                // a trail point only when the agent has moved, so a figure at rest keeps its last trails
                const [X, Y] = P(ag.sx, ag.sy), tr = (ag.trail = ag.trail || []), last = tr[tr.length - 1];
                if (!last || Math.hypot(X - last[0], Y - last[1]) > 0.5) { tr.push([X, Y]); if (tr.length > 160) tr.shift(); }
            });
            st.agents.forEach((ag) => { if (ag.trail && ag.trail.length > 1) K.line(ctx, C, ag.trail, -1, 0.25); });
            st.agents.forEach((ag) => { if (ag.sx != null) K.pt(ctx, C, ...P(ag.sx, ag.sy), 0, ag.done ? 0.25 : 1); });
            K.fade = 1;
            // the learning curve: two axes; every batch's mean return (a u line, smoothed over a few batches, ending in a
            // focus point) and the share reaching the goal (dotted, on its own 0–100% scale)
            const pl = st.plot, gx = pl.x, gw = pl.w, gy0 = pl.y, gy1 = pl.y + pl.h, H = st.hist || [], nC = H.length;
            K.line(ctx, C, [[gx, gy0], [gx, gy1], [gx + gw, gy1]], -1, 0.5);
            const ema = (xs) => { const o = []; xs.forEach((v, i) => o.push(i ? 0.8 * o[i - 1] + 0.2 * v : v)); return o; };
            const sr = ema(H.map((b) => b.r)), sw = ema(H.map((b) => b.w));
            if (nC > 1) {
                K.fade = K.ease(fadeIn);   // the curve fades in with the arena's contents
                // x by batches done (buckets hold different spans), y the smoothed mean return on its own range
                const tot = H.reduce((a, b) => a + b.n, 0), xs = []; let acc = 0; H.forEach((b) => { xs.push(gx + ((acc + b.n / 2) / tot) * gw); acc += b.n; });
                const lo = Math.min(...sr), hi = Math.max(...sr), pad = Math.max(0.1, (hi - lo) * 0.1), Y = (v) => gy1 - ((v - lo + pad) / (hi - lo + 2 * pad)) * (gy1 - gy0);
                const pts = sr.map((v, i) => [xs[i], Y(v)]);
                K.line(ctx, C, pts, 0, 1); K.pt(ctx, C, ...pts[pts.length - 1], 1, 1);
                K.dotted(ctx, C, sw.map((v, i) => [xs[i], gy1 - v * (gy1 - gy0)]), -1, 0.5);
                K.fade = 1;
            }
            // the rows: track at context tone, up to the value at data tone, the value a focus point
            const pn = st.panel;
            F.rlcont.ROWS.forEach(([key, name, [lo, hi], log, fmt], i) => {
                const v = st.p[key], k = log ? Math.log(v / lo) / Math.log(hi / lo) : (v - lo) / (hi - lo);
                slider(ctx, C, st, pn.x, pn.x + pn.w, st.rows[i].y + st.rows[i].h * 0.75, k, `${name} ${fmt(v)}`);
            });
            { const y = st.rows[4].y + st.rows[4].h * 0.55; label(ctx, C, st, train ? 'training · pause to test it' : st.batch ? 'paused · drag things to test it' : 'hover to train', pn.x, y, 'left', true); }
            const lastW = nC ? sw[nC - 1] : 0;
            if (nC) { label(ctx, C, st, `level ${st.level || 0} · batch ${st.batch}`, gx + K.LN, gy0 - K.LN / 2, 'left', true); label(ctx, C, st, `goal ${Math.round(lastW * 100)}%`, gx + gw, gy0 - K.LN / 2, 'right', true); }
            if (go) st.wake = Math.max(st.wake || 0, 0.3);   // awake while it trains, or for a while after it was handled
        },
    };

    // Scaling laws, measured: the solvable model of Maloney, Roberts & Sully (2022), trained here. A task with M = 1024
    // latent dimensions whose variances fall as a power law (λₖ ∝ k^−2), a hidden linear target and label noise; seven
    // models of N = 2 … 128 weights on nested random features of the input, each trained by online SGD (learning rate η/N,
    // one fresh sample per step) in background workers (the sizes shared out over up to four). Each run's exact population
    // loss (relative to predicting zero) is plotted as it trains, as its excess over the irreducible loss E (the label
    // noise's) against its training compute C = 6ND on log–log axes, where a power law is a straight line; every run goes
    // to the same budgets, so the plot fills from left to right. The lower envelope of all runs is the compute-optimal
    // frontier, with a focus point where a bigger model takes it over; the scaling law is the straight line fitted through
    // it from the second hand-over on (L − E ∝ C^γ), drawn dotted across the whole range, and the winning size's growth (N
    // ∝ C^κ) is fitted too: both come from the runs, not put in. The rows set the learning rate and the label noise; a
    // change trains everything again.
    F.scaling2 = {
        bleed: true, tall: true, M: 1024, SIZES: [2, 4, 8, 16, 32, 64, 128], CMIN: 1.5e3, CMAX: 2.5e7, POINTS: 64,
        ETA: [0.01, 0.3], NOISE: [0, 0.1],
        // the training loop compiled from tools/scaling.wat (single precision, four SIMD lanes; the JavaScript loop below stays as the fallback)
        WASM: 'AGFzbQEAAAABGARgAXwBfGABfwBgAAF8YAd/f39/f3x/AAIJAQFtA2xvZwAAAwUEAQICAwUDAQAEBhcDfwFBAQt8AUQAAAAAAAAAAAt/AUEACwcWAwNtZW0CAARzZWVkAAEFdHJhaW4ABAqnBQQKACAAJABBACQCC0wBAX8jAEH1863pBmokACMAIQAgACAAQQ92cyAAQQFybCEAIAAgACAAIABBB3ZzIABBPXJsanMhACAAIABBDnZzuEQAAAAAAADwQaMLjwEBBHwjAgRAQQAkAiMBDwsDQBACRAAAAAAAAABAokQAAAAAAADwP6EhABACRAAAAAAAAABAokQAAAAAAADwP6EhASAAIACiIAEgAaKgIQIgAkQAAAAAAADwP2YgAkQAAAAAAAAAAGFyDQALRAAAAAAAAADAIAIQAKIgAqOfIQMgASADoiQBQQEkAiAAIAOiC7sDAwV/AXsCfCABQQFrIQsCQANAIAcgBk8NAUEAIQgCQANAIAggAU8NASAEIAhBAnRqEAO2OAIAIAhBAWohCAwACwtBACEIAkADQCAIIAFPDQEgACAIIAFsQQJ0aiEK/QwAAAAAAAAAAAAAAAAAAAAAIQxBACEJAkADQCAJQQNqIAhKDQEgDCAKIAlBAnRq/QAEACAEIAlBAnRq/QAEAP3mAf3kASEMIAlBBGohCQwACwsgDP0fALsgDP0fAbugIAz9HwK7IAz9HwO7oKAhDQJAA0AgCSAISg0BIA0gCiAJQQJ0aioCACAEIAlBAnRqKgIAlLugIQ0gCUEBaiEJDAALCyADIAhBAnRqIA22OAIAIAhBAWohCAwACwtEAAAAAAAAAAAhDUEAIQgCQANAIAggC08NASANIAIgCEECdGoqAgAgAyAIQQJ0aioCAJS7oCENIAhBAWohCAwACwsgBSADIAtBAnRqKgIAuyANoaIhDkEAIQgCQANAIAggC08NASACIAhBAnRqIAIgCEECdGoqAgAgDrYgAyAIQQJ0aioCAJSSOAIAIAhBAWohCAwACwsgB0EBaiEHDAALCws=',
        title: 'Scaling laws', note: 'Seven model sizes train on one task; the lowest loss at each compute falls on a straight line in log–log axes, the scaling law, fitted from the runs.',
        // the experiment, run in a worker (posted one budget at a time); self-contained, so it can be its source
        experiment(cfg, post) {
            const { M, sizes, alpha, noise, Cmin, Cmax, points, eta, seed, wasm } = cfg, mine = cfg.mine || sizes.map((_, i) => i);
            let s = seed >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            let spare = null; const randn = () => { if (spare != null) { const v = spare; spare = null; return v; } let u = 0; while (!u) u = rnd(); const v = rnd(), r = Math.sqrt(-2 * Math.log(u)); spare = r * Math.sin(2 * Math.PI * v); return r * Math.cos(2 * Math.PI * v); };
            const lam = new Float64Array(M), sq = new Float64Array(M); let tot = 0; for (let k = 0; k < M; k++) { lam[k] = (k + 1) ** -(1 + alpha); tot += lam[k]; } for (let k = 0; k < M; k++) { lam[k] /= tot; sq[k] = Math.sqrt(lam[k]); }
            const wstar = new Float64Array(M); for (let k = 0; k < M; k++) wstar[k] = randn();
            const Nmax = Math.max(...sizes), P = new Float64Array(Nmax * M); for (let i = 0; i < P.length; i++) P[i] = randn();
            let L0 = noise; for (let k = 0; k < M; k++) L0 += lam[k] * wstar[k] ** 2;
            const runs = mine.map((i) => ({ N: sizes[i], v: new Float64Array(sizes[i]), lr: eta / sizes[i], d: 0 }));
            s = (cfg.stream ?? seed) >>> 0; spare = null;   // this worker's own samples, after the shared task
            const loss = (run) => { const u = new Float64Array(M); for (let j = 0; j < run.N; j++) { const vj = run.v[j], row = j * M; for (let k = 0; k < M; k++) u[k] += P[row + k] * vj; } let l = noise; for (let k = 0; k < M; k++) l += lam[k] * (u[k] - wstar[k]) ** 2; return l / L0; };
            // a model sees only its features z = P_N x and the target y, jointly Gaussian with a known covariance, so a
            // sample is drawn directly through that covariance's Cholesky factor: the same data, (N+1)²/2 operations a
            // sample instead of N·M
            runs.forEach((r) => {
                const N = r.N, n = N + 1, A = new Float64Array(n * n), pl = new Float64Array(N * M);
                for (let j = 0; j < N; j++) for (let k = 0; k < M; k++) pl[j * M + k] = P[j * M + k] * lam[k];
                for (let a = 0; a < N; a++) { for (let b = 0; b <= a; b++) { let q = 0; for (let k = 0; k < M; k++) q += pl[a * M + k] * P[b * M + k]; A[a * n + b] = q; } let q = 0; for (let k = 0; k < M; k++) q += pl[a * M + k] * wstar[k]; A[N * n + a] = q; }
                let yy = noise; for (let k = 0; k < M; k++) yy += lam[k] * wstar[k] ** 2; A[N * n + N] = yy;
                for (let a = 0; a < n; a++) for (let b = 0; b <= a; b++) { let q = A[a * n + b]; for (let k = 0; k < b; k++) q -= A[a * n + k] * A[b * n + k]; A[a * n + b] = a === b ? Math.sqrt(Math.max(q, 1e-12)) : q / A[b * n + b]; }
                r.chol = A;
            });
            // the training loop in WebAssembly where it can run: every run's factor and weights in its memory, the weights
            // read back in place for the loss
            let W = null, zp = 0, gp = 0;
            try {
                if (wasm && typeof WebAssembly !== 'undefined') {
                    const bin = atob(wasm), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    W = new WebAssembly.Instance(new WebAssembly.Module(bytes), { m: { log: Math.log } }).exports; W.seed((cfg.stream ?? seed) | 0);
                    const q16 = (b) => Math.ceil(b / 16) * 16;   // single precision; rows start where SIMD likes them
                    let off = 0; runs.forEach((r) => { r.Lp = off; off = q16(off + (r.N + 1) ** 2 * 4); r.vp = off; off = q16(off + (r.N + 1) * 4); }); zp = off; off = q16(off + (Nmax + 1) * 4); gp = off; off = q16(off + (Nmax + 1) * 4);
                    const need = Math.ceil(off / 65536) - W.mem.buffer.byteLength / 65536; if (need > 0) W.mem.grow(need);
                    runs.forEach((r) => { new Float32Array(W.mem.buffer, r.Lp, (r.N + 1) ** 2).set(r.chol); r.v = new Float32Array(W.mem.buffer, r.vp, r.N); r.v.fill(0); });
                }
            } catch (e) { W = null; runs.forEach((r) => { r.v = new Float64Array(r.N); }); }
            const g = new Float64Array(Nmax + 1), z = new Float64Array(Nmax + 1);
            for (let i = 0; i < points; i++) {
                const c = Cmin * (Cmax / Cmin) ** (i / (points - 1));
                for (const r of runs) {
                    const goal = Math.floor(c / (6 * r.N)), N = r.N, n = N + 1, Lc = r.chol, v = r.v, lr = r.lr;
                    if (W) { if (goal > r.d) { W.train(r.Lp, n, r.vp, zp, gp, lr, goal - r.d); r.d = goal; } continue; }
                    for (; r.d < goal; r.d++) {
                        for (let a = 0; a < n; a++) g[a] = randn();
                        for (let a = 0; a < n; a++) { let q = 0; const row = a * n; for (let b = 0; b <= a; b++) q += Lc[row + b] * g[b]; z[a] = q; }
                        let pr = 0; for (let j = 0; j < N; j++) pr += v[j] * z[j];
                        const e = (z[N] - pr) * lr; for (let j = 0; j < N; j++) v[j] += e * z[j];
                    }
                }
                post({ i, c, E: noise / L0, mine, losses: runs.map((r) => r.d ? loss(r) : 1) });
            }
        },
        init(R, rand) {
            const lay = K.stack(R, 4 / 3, 2), rp = lay.main, rc = lay.strip;
            const st = { r: rand(41), plot: { x: rp.x, y: rp.y, w: rp.w, h: rp.h }, panel: { x: rc.x, w: rc.w }, eta: 0.05, noise: 0.01, rows: [0, 1].map((i) => ({ y: rc.y + i * rc.h / 2, h: rc.h / 2 })), data: [], E: 0 };
            idle(() => { if (!st.disposed) F.scaling2.train(st); });
            return st;
        },
        // the sizes shared out over up to four workers (one core left for the page), the largest first to the least loaded
        // (a run's work grows about as N); each rebuilds the task from the seed, draws its own samples, and posts each budget;
        // a budget is drawn once every worker has reported it
        train(st) {
            const S = F.scaling2; F.scaling2.dispose(st); st.data = []; st.E = st.noise / (1 + st.noise); st.done = false;
            if (typeof Worker === 'undefined' || typeof Blob === 'undefined') return;
            const seed = Math.floor(st.r() * 2 ** 31), K = Math.min(DEVICE.workers, S.SIZES.length);
            const parts = Array.from({ length: K }, () => ({ mine: [], load: 0 }));
            S.SIZES.map((N, i) => [N, i]).sort((x, y) => y[0] - x[0]).forEach(([N, i]) => { const pt = parts.reduce((m, q) => (q.load < m.load ? q : m)); pt.mine.push(i); pt.load += N; });
            const src = `const experiment = ${S.experiment.toString().replace(/^experiment/, 'function')};\nonmessage = (e) => { experiment(e.data, (m) => postMessage(m)); postMessage({ done: true }); };`;
            const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), rows = [], got = new Array(S.POINTS).fill(0); let finished = 0;
            st.workers = parts.map((pt, k) => {
                const w = new Worker(url);
                w.onmessage = (e) => {
                    const m = e.data;
                    if (m.done) { if (++finished === K) { st.done = true; F.scaling2.dispose(st); } st.request?.(); return; }   // all in: no worker kept
                    const row = rows[m.i] || (rows[m.i] = { c: m.c, losses: new Array(S.SIZES.length).fill(1) }); m.mine.forEach((j, q) => (row.losses[j] = m.losses[q])); st.E = m.E;
                    if (++got[m.i] === K) { while (st.data.length < S.POINTS && got[st.data.length] === K) st.data.push(rows[st.data.length]); st.request?.(); }
                };
                w.postMessage({ M: S.M, sizes: S.SIZES, alpha: 1, noise: st.noise, Cmin: S.CMIN, Cmax: S.CMAX, points: S.POINTS, eta: st.eta, seed, stream: seed + 7919 * (k + 1), mine: pt.mine, wasm: S.WASM });
                return w;
            });
            URL.revokeObjectURL(url);
        },
        dispose(st) { (st.workers || []).forEach((w) => w.terminate()); st.workers = null; },
        // out of sight (hidden tab, scrolled away, page put away): no worker keeps running; back in sight, a run cut short
        // starts again
        away(st) { if (st.workers && !st.done) { F.scaling2.dispose(st); st.cut = true; } },
        back(st) { if (st.cut) { st.cut = false; F.scaling2.train(st); } },
        // drag along a row to set it; on release everything trains again
        pointer(type, x, y, st) {
            const S = F.scaling2, pn = st.panel, at = ([lo, hi], log) => { const k = Math.max(0, Math.min(1, (x - pn.x) / pn.w)); return log ? lo * (hi / lo) ** k : lo + k * (hi - lo); };
            if (type === 'down') st.drag = st.rows.findIndex((r) => y >= r.y && y < r.y + r.h && x >= pn.x - 10 && x <= pn.x + pn.w + 10);
            if (st.drag == null || st.drag < 0) return;
            if (type === 'down' || type === 'move') { if (st.drag === 0) st.eta = +at(S.ETA, true).toPrecision(2); else st.noise = Math.round(at(S.NOISE) * 200) / 200; st.wake = 1; }
            if (type === 'up' || type === 'leave') { st.drag = null; S.train(st); st.wake = 4; }
        },
        draw(ctx, R, t, C, st, still) {
            // log–log axes of the excess loss L − E against compute: a power law is a straight line here
            const S = F.scaling2, pl = st.plot, n = st.data.length, E = st.E;
            const ex = (l) => Math.max(1e-6, l - E);
            // each run's curve smoothed as training curves are shown: an exponential moving average over its budgets, in
            // log space (weight 0.6 on the past); the frontier and the law are read from the smoothed curves
            const data = []; st.data.forEach((d, k) => data.push({ c: d.c, losses: d.losses.map((l, i) => (k ? 10 ** (0.6 * Math.log10(ex(data[k - 1].losses[i])) + 0.4 * Math.log10(ex(l))) : ex(l)) + E) }));
            const gs = data.flatMap((d) => d.losses.map(ex));
            const lx0 = Math.log10(S.CMIN), lx1 = Math.log10(S.CMAX), ly1 = Math.log10(1.2 * Math.max(...gs, 1 - E)), ly0 = Math.min(ly1 - 1, Math.log10(0.6 * Math.min(...gs, 0.5)));
            const X = (c) => pl.x + ((Math.log10(c) - lx0) / (lx1 - lx0)) * pl.w, Y = (g) => pl.y + ((ly1 - Math.log10(g)) / (ly1 - ly0)) * pl.h;
            K.line(ctx, C, [[pl.x, pl.y], [pl.x, pl.y + pl.h], [pl.x + pl.w, pl.y + pl.h]], -1, 0.5);
            // runs at data tone, each ending in a point (a focus point while it trains)
            S.SIZES.forEach((N, i) => { const pts = data.map((d) => [X(d.c), Y(ex(d.losses[i]))]); if (pts.length > 1) K.line(ctx, C, pts, -1, 0.5); if (pts.length) K.pt(ctx, C, ...pts[pts.length - 1], st.done ? -1 : 0, st.done ? 0.5 : 1); });
            // the frontier: the lowest loss at each budget (a 2u line), and where a bigger model takes it over (focus points)
            const front = data.map((d) => { let b = 0; d.losses.forEach((l, i) => { if (l < d.losses[b]) b = i; }); return { c: d.c, g: ex(d.losses[b]), N: S.SIZES[b] }; });
            if (front.length > 1) K.line(ctx, C, front.map((f) => [X(f.c), Y(f.g)]), 1, 1);
            const hand = front.filter((f, k) => k > 0 && f.N > front[k - 1].N);
            hand.forEach((f) => K.pt(ctx, C, X(f.c), Y(f.g), 1, 1));
            // the law: a least-squares line through the frontier from the second hand-over on (the first falls in the early
            // transient, before the frontier settles), drawn across the whole range
            const fit = (pts) => { const mx = pts.reduce((a, q) => a + q[0], 0) / pts.length, my = pts.reduce((a, q) => a + q[1], 0) / pts.length, sxx = pts.reduce((a, q) => a + (q[0] - mx) ** 2, 0); if (!sxx) return null; const b = pts.reduce((a, q) => a + (q[0] - mx) * (q[1] - my), 0) / sxx; return { b, a: my - b * mx }; };
            const from = front.indexOf(hand[1] || hand[0]), law = hand.length && front.length - from > 3 ? fit(front.slice(from).map((f) => [Math.log10(f.c), Math.log10(f.g)])) : null;
            const best = front.length > 6 ? fit(front.map((f) => [Math.log10(f.c), Math.log10(f.N)])) : null;
            if (law && st.done) K.dotted(ctx, C, [[pl.x, Y(10 ** (law.a + law.b * lx0))], [pl.x + pl.w, Y(10 ** (law.a + law.b * lx1))]].map(([x, y]) => [x, Math.max(pl.y, Math.min(pl.y + pl.h, y))]), 0, 1);
            // the rows: track at context tone, up to the value at data tone, the value a focus point
            const pn = st.panel;
            slider(ctx, C, st, pn.x, pn.x + pn.w, st.rows[0].y + st.rows[0].h * 0.75, Math.log(st.eta / S.ETA[0]) / Math.log(S.ETA[1] / S.ETA[0]), `learning rate ${st.eta}`);
            slider(ctx, C, st, pn.x, pn.x + pn.w, st.rows[1].y + st.rows[1].h * 0.75, (st.noise - S.NOISE[0]) / (S.NOISE[1] - S.NOISE[0]), `label noise ${st.noise.toFixed(3)}`);
            const ly = (i) => st.rows[i].y + st.rows[i].h / 2 - K.LN / 2, sci = (v) => { const e = Math.floor(Math.log10(v)); return `${(v / 10 ** e).toFixed(1)}e${e}`; };
            label(ctx, C, st, 'loss above the floor', pl.x, pl.y - K.LN / 2, 'left');
            label(ctx, C, st, 'compute', pl.x + pl.w, pl.y + pl.h + K.LN / 2, 'right');
            if (n) { S.SIZES.forEach((N, i) => label(ctx, C, st, `${N}`, X(data[n - 1].c) + K.LN / 4, Y(ex(data[n - 1].losses[i])), 'left')); label(ctx, C, st, 'weights', pl.x + pl.w + K.LN / 4, pl.y + K.LN / 4, 'left'); }
            label(ctx, C, st, !st.done ? `training ${Math.round((100 * n) / S.POINTS)}%` : law ? `law: loss ∝ compute^${law.b.toFixed(2)}` : '', pl.x + pl.w, pl.y - K.LN / 2, 'right', true);
            if (st.done && best && hand.length) label(ctx, C, st, `best size ∝ compute^${best.b.toFixed(2)}`, X(hand[hand.length - 1].c) - K.LN / 4, Y(hand[hand.length - 1].g) + K.LN / 2, 'right');
        },
    };

    // Attention: two heads. Tokens are small embedding columns on a lower and an upper row; faint point
    // arcs run from each query to every earlier token (upper head drawn downward); as the queries move
    // between scenes the arcs reshape; the strongest links assemble in the accent
    F.attention = scenes({
        bleed: true, period: 11, quick: 4,
        title: 'Attention', note: 'Two heads over a row of tokens; each query attends to every earlier token, the strongest links in the accent.',
        build(R, r, n, s) {
            const T = 20, fx = R.fx ?? R.x, vy0 = R.vy0 ?? R.y, vh = (R.vy1 ?? R.y + R.h) - vy0, base = vy0 + vh - 4, top = vy0 + 22;
            const x0 = R.x + (fx - R.x) * 0.5, xs = Array.from({ length: T }, (_, i) => x0 + 8 + (i * (R.x + R.w - x0 - 16)) / (T - 1));
            const pickQ = () => { let q = Math.floor(T * (0.55 + 0.4 * r())); while (xs[q] < fx + 20) q++; return Math.min(T - 1, q); };
            const qa = s.q != null ? Math.max(1, Math.min(T - 1, s.q)) : pickQ(), qb = pickQ(); s.xs = xs;
            const arc = (q, j, n2, y, dir) => { const xA = xs[j], xB = xs[q], h = Math.min(vh * 0.62, (xB - xA) * 0.7 + 10); return Array.from({ length: n2 }, (_, k) => { const u = k / (n2 - 1), v = 1 - u; return [v * v * v * xB + 3 * v * v * u * xB + 3 * v * u * u * xA + u * u * u * xA, y + dir * (3 * (v * v * u + v * u * u) * h)]; }); };
            const field = [];
            [[base, qa, -1], [top, qb, 1]].forEach(([y, q, dir], row) => {
                xs.forEach((x, i) => { for (let k = 0; k < 6; k++) field.push([x, y - dir * k * 3 * -1, i === q ? 1.8 : 0.4 + r() * 1.2]); });
                for (let j = 0; j < T - 1; j++) { const pts = j < q ? arc(q, j, 90, y + (dir < 0 ? -18 : 18), dir) : Array(90).fill([xs[j], y + (dir < 0 ? -18 : 18)]); pts.forEach((p2, k) => field.push([p2[0], p2[1], j < q ? (k % 2 ? 0.3 : (row ? 0.8 : 1)) : 0])); }
            });
            const top3 = (q) => Array.from({ length: q }, (_, j) => [r() * (0.4 + j / q), j]).sort((a, b) => b[0] - a[0]).slice(0, 3).map((e) => e[1]);
            const ka = top3(qa), kb = top3(qb);
            return { field, lines: {
                k1: arc(qa, ka[0], 240, base - 18, -1), k2: arc(qa, ka[1] ?? ka[0], 240, base - 18, -1), k3: arc(qa, ka[2] ?? ka[0], 240, base - 18, -1),
                h2: arc(qb, kb[0], 200, top + 18, 1),
            } };
        },
        pointer(type, x, y, s) {
            if ((type !== 'move' && type !== 'down') || !s.xs) return;
            let q = 0, bd = Infinity; s.xs.forEach((xx, i) => { const d = Math.abs(xx - x); if (d < bd) { bd = d; q = i; } });
            if (q !== s.q) { s.q = q; s.force = true; }
        },
        lines: { k1: { K: 240, style: [2.2, 1, 0], sweep: 0.3 }, k2: { K: 240, style: [1.7, 0.55, 0.05], sweep: 0.3 }, k3: { K: 240, style: [1.4, 0.35, 0.1], sweep: 0.3 }, h2: { K: 200, style: [1.6, 0.5, 0.14], sweep: 0.3 } },
    });

    // Reaction–diffusion (Gray–Scott), running continuously on a 4px grid. The pattern is drawn as a dot
    // screen (larger, darker dots where v is high); where the pattern is growing, the dot turns accent, so
    // the advancing fronts show. Feed and kill drift slowly between spot and maze regimes, and new seeds
    // drop in now and then, so the pattern keeps reorganising.
    F.turing = {
        bleed: true,
        title: 'Reaction–diffusion', note: 'Gray–Scott chemistry: spots and stripes self-organise from local rules; growth fronts in the accent.',
        init(R, rand) {
            const S = 4, Cx = Math.ceil(R.w / S), Cy = Math.ceil(R.h / S), N = Cx * Cy, r = rand(3);
            const u = new Float32Array(N).fill(1), v = new Float32Array(N), prev = new Float32Array(N);
            const st = { S, Cx, Cy, u, v, prev, r, seedAt: 0, t: 0 };
            for (let k = 0; k < 10; k++) F.turing.seed(st, R);
            for (let i = 0; i < 2200; i++) F.turing.step(st, 0.0367, 0.0649);
            return st;
        },
        seed(st, R) {
            const { Cx, Cy, u, v, r } = st, fxC = Math.floor(((R.fx ?? R.x) - R.x) / st.S);
            const cx = fxC + Math.floor(r() * (Cx - fxC)), cy = Math.floor(r() * Cy);
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const i = ((cy + dy + Cy) % Cy) * Cx + ((cx + dx + Cx) % Cx); v[i] = 0.5 + r() * 0.2; u[i] = 0.5; }
        },
        step(st, f, k) {
            const { Cx, Cy, u, v } = st, N = Cx * Cy, nu = new Float32Array(N), nv = new Float32Array(N);
            for (let y = 0; y < Cy; y++) {
                const yu = ((y - 1 + Cy) % Cy) * Cx, yd = ((y + 1) % Cy) * Cx, yc = y * Cx;
                for (let x = 0; x < Cx; x++) {
                    const i = yc + x, l = yc + (x - 1 + Cx) % Cx, rr = yc + (x + 1) % Cx, up = yu + x, dn = yd + x;
                    const lu = u[l] + u[rr] + u[up] + u[dn] - 4 * u[i], lv = v[l] + v[rr] + v[up] + v[dn] - 4 * v[i], uvv = u[i] * v[i] * v[i];
                    nu[i] = u[i] + 0.2 * lu - uvv + f * (1 - u[i]);
                    nv[i] = v[i] + 0.1 * lv + uvv - (f + k) * v[i];
                }
            }
            st.u = nu; st.v = nv;
        },
        draw(ctx, R, t, C, st, still) {
            if (!still) {
                // feed/kill drift slowly between spots (0.0367, 0.0649) and mazes (0.029, 0.057)
                const m = 0.5 + 0.5 * Math.sin(t * 0.035), f = 0.0367 + (0.029 - 0.0367) * m, k = 0.0649 + (0.057 - 0.0649) * m;
                st.prev.set(st.v);
                for (let i = 0; i < 3; i++) F.turing.step(st, f, k);
                if (t - st.seedAt > 6) { F.turing.seed(st, R); st.seedAt = t; }
            }
            const { S, Cx, Cy, v, prev } = st;
            for (let y = 0; y < Cy; y++) for (let x = 0; x < Cx; x++) {
                const i = y * Cx + x, a = Math.min(1, v[i] * 3.2);
                if (a < 0.12) continue;
                const grow = still ? 0 : (v[i] - prev[i]) * 600, px = R.x + x * S + S / 2, py = R.y + y * S + S / 2, sz = 0.8 + 1.4 * a;
                if (grow > 0.25) { ctx.globalAlpha = Math.min(1, grow) * 0.9; ctx.fillStyle = C.accent; }
                else { ctx.globalAlpha = 0.25 + 0.5 * a; ctx.fillStyle = C.ink3; }
                ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
            }
        },
    };

    // Physarum: agents follow and lay trails; a transport network self-organises
    F.physarum = {
        bleed: true,
        title: 'Slime mould', note: 'Physarum agents follow and reinforce trails; a network emerges without a planner.',
        init(R, rand) {
            const S = 3, Cx = Math.floor(R.w / S), Cy = Math.floor(R.h / S), r = rand(4);
            const agents = Array.from({ length: 160 }, () => ({ x: r() * Cx, y: r() * Cy, a: r() * TAU }));
            const st = { S, Cx, Cy, trail: new Float32Array(Cx * Cy), agents, r };
            for (let i = 0; i < 120; i++) F.physarum.step(st);
            return st;
        },
        step(s) {
            const { Cx, Cy, trail, agents } = s, SA = 0.6, SD = 4, RA = 0.35;
            const at = (x, y) => trail[((Math.floor(y) + Cy) % Cy) * Cx + ((Math.floor(x) + Cx) % Cx)];
            for (const g of agents) {
                const f = at(g.x + Math.cos(g.a) * SD, g.y + Math.sin(g.a) * SD), l = at(g.x + Math.cos(g.a - SA) * SD, g.y + Math.sin(g.a - SA) * SD), r = at(g.x + Math.cos(g.a + SA) * SD, g.y + Math.sin(g.a + SA) * SD);
                if (f < l && f < r) g.a += (s.r() < 0.5 ? -1 : 1) * RA; else if (l > r) g.a -= RA; else if (r > l) g.a += RA;
                g.x = (g.x + Math.cos(g.a) * 0.5 + Cx) % Cx; g.y = (g.y + Math.sin(g.a) * 0.5 + Cy) % Cy;
                trail[Math.floor(g.y) * Cx + Math.floor(g.x)] += 1;
            }
            const nt = new Float32Array(Cx * Cy);
            for (let y = 0; y < Cy; y++) for (let x = 0; x < Cx; x++) { let sum = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += trail[((y + dy + Cy) % Cy) * Cx + ((x + dx + Cx) % Cx)]; nt[y * Cx + x] = (sum / 9) * 0.9; }
            s.trail = nt;
        },
        draw(ctx, R, t, C, s, still) {
            if (!still) F.physarum.step(s);
            const { S, Cx, Cy, trail } = s;
            const lead = s.agents[0]; s.hist = (s.hist || []).concat([[R.x + lead.x * S, R.y + lead.y * S]]).slice(-5);
            if (s.hist.some((q, i) => i && Math.hypot(q[0] - s.hist[i - 1][0], q[1] - s.hist[i - 1][1]) > 20)) s.hist = s.hist.slice(-1);
            ctx.fillStyle = C.ink2;
            for (let y = 0; y < Cy; y += 2) for (let x = 0; x < Cx; x += 2) { const a = Math.min(1, trail[y * Cx + x] * 0.6); if (a < 0.15) continue; ctx.globalAlpha = 0.4 * a; ctx.fillRect(R.x + x * S, R.y + y * S, 1.5, 1.5); }
            const [hx, hy] = s.hist[s.hist.length - 1]; glow(ctx, C, hx, hy, s.hist.slice(0, -1));
        },
    };

    // Evolutionary search: a population samples a landscape and narrows on an optimum
    F.evolution = {
        title: 'Evolutionary search', note: 'A population samples a landscape; each generation moves toward the fittest and narrows.',
        init: () => ({}),
        draw(ctx, R, t, C, s, still, rand) {
            const P = 12, n = Math.floor(t / P), p = (t % P) / P, r = rand(n);
            const ox = R.x + R.w * (0.25 + r() * 0.5), oy = R.y + R.h * (0.25 + r() * 0.5);
            ctx.fillStyle = C.ink3;
            for (let k = 1; k <= 4; k++) { const rx = k * R.w * 0.11, ry = k * R.h * 0.17, m = Math.floor(k * 22); for (let i = 0; i < m; i++) { const a = (i / m) * TAU; ctx.globalAlpha = 0.45; ctx.fillRect(ox + Math.cos(a) * rx - 0.6, oy + Math.sin(a) * ry - 0.6, 1.2, 1.2); } }
            const sx = R.x + R.w * r(), sy = R.y + R.h * r(), k = still ? 0.7 : ease(p / 0.85), mx = sx + (ox - sx) * k, my = sy + (oy - sy) * k, spread = (1 - k * 0.85) * Math.min(R.w, R.h) * 0.3;
            const gen = Math.floor((still ? 0.7 : p) * 10), rg = rand(n * 100 + gen);
            for (let i = 0; i < 16; i++) { const a = rg() * TAU, d = Math.sqrt(rg()) * spread; dot(ctx, mx + Math.cos(a) * d, my + Math.sin(a) * d * 0.7, 1.4, C.ink2, 0.5); }
            const back = (dk) => { const kk = Math.max(0, k - dk); return [sx + (ox - sx) * kk, sy + (oy - sy) * kk]; };
            glow(ctx, C, mx, my, [back(0.09), back(0.06), back(0.03)]);
        },
    };

    // Self-organising map: a lattice unfolds to cover the shape of the data
    F.som = {
        title: 'Self-organising map', note: 'A Kohonen lattice unfolds to cover the data, one sample at a time.',
        init(R, rand) {
            const r = rand(7), Gx = 8, Gy = 5, nodes = Array.from({ length: Gx * Gy }, () => ({ x: R.x + R.w * (0.4 + r() * 0.2), y: R.y + R.h * (0.4 + r() * 0.2) }));
            return { Gx, Gy, nodes, r, iter: 0 };
        },
        draw(ctx, R, t, C, s, still) {
            const { Gx, Gy, nodes, r } = s;
            const steps = still ? 1500 - s.iter : 2;
            let sample = null;
            for (let k = 0; k < steps; k++) {
                if (s.iter > 1800) { s.iter = 0; nodes.forEach((q) => { q.x = R.x + R.w * (0.4 + r() * 0.2); q.y = R.y + R.h * (0.4 + r() * 0.2); }); }
                const a = r() * TAU, rad = 0.65 + r() * 0.35; sample = { x: R.x + R.w / 2 + Math.cos(a) * rad * R.w * 0.45, y: R.y + R.h / 2 + Math.sin(a) * rad * R.h * 0.45 };
                let best = 0, bd = Infinity; nodes.forEach((q, i) => { const d = (q.x - sample.x) ** 2 + (q.y - sample.y) ** 2; if (d < bd) { bd = d; best = i; } });
                const lr = 0.3 * Math.exp(-s.iter / 900), sigma = 0.5 + 3 * Math.exp(-s.iter / 500), bx = best % Gx, by = Math.floor(best / Gx);
                nodes.forEach((q, i) => { const d2 = (i % Gx - bx) ** 2 + (Math.floor(i / Gx) - by) ** 2, h = Math.exp(-d2 / (2 * sigma * sigma)) * lr; q.x += (sample.x - q.x) * h; q.y += (sample.y - q.y) * h; });
                s.iter++;
            }
            for (let j = 0; j < Gy; j++) for (let i = 0; i < Gx; i++) { const q = nodes[j * Gx + i]; if (i + 1 < Gx) line(ctx, q.x, q.y, nodes[j * Gx + i + 1].x, nodes[j * Gx + i + 1].y, C.ink3, 0.3); if (j + 1 < Gy) line(ctx, q.x, q.y, nodes[(j + 1) * Gx + i].x, nodes[(j + 1) * Gx + i].y, C.ink3, 0.3); }
            nodes.forEach((q) => dot(ctx, q.x, q.y, 1.3, C.ink3, 0.7));
            if (sample && !still) glow(ctx, C, sample.x, sample.y);
        },
    };

    // The grid itself, for the rules page
    F.lattice = {
        bleed: true,
        title: 'Lattice', note: 'The 24px grid itself.',
        init: () => ({}),
        draw(ctx, R, t, C, s, still) {
            const T = still ? 0 : t;
            for (let y = R.y; y <= R.y + R.h; y += 24) for (let x = R.x; x <= R.x + R.w; x += 24) {
                const w = 0.5 + 0.5 * Math.sin((x - R.x) * 0.03 - (y - R.y) * 0.04 - T * 0.4);
                ctx.globalAlpha = 0.3 + 0.4 * w; ctx.fillStyle = C.ink3; ctx.fillRect(x - 1, y - 1, 2, 2);
            }
        },
    };

    // Shared driver: mount(canvas, region-fn, figure name) runs one figure on one canvas
    function mount(canvas, name, regionFn, opts = {}) {
        const fig = F[name]; if (!fig) return;
        const root = document.documentElement, ctx = canvas.getContext('2d');
        const SEED = 1 + Math.floor(Math.random() * 2e9);
        const rand = (k) => { let s = (SEED + k * 7919) % 2147483646 + 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
        let touched = !opts.staticUntilTouched;
        const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('no-motion');
        const still = () => reduced() || !touched;
        let C = {}, R = { x: 0, y: 0, w: 0, h: 0 }, state = null, raf = 0, visible = true, W = 0, H = 0;
        let t0 = performance.now(), awakeUntil = 0;
        // the opening: the figure appears — one change of tone, 4τ, on the one curve
        const INTRO = 4 * K.TB; let introT0 = null, introDone = false;
        // the blur is drawn inside the canvas (a copy, redrawn through ctx.filter), never set on the element: a CSS
        // filter on a canvas redrawn every frame can paint a black frame when the page is torn down mid-animation
        let soft = null;
        const reveal = (now) => {
            let fb = 0, a = 1;   // focus: the figure sharpens as it appears (4u to 0 over 4τ)
            if (!introDone && !reduced()) {
                if (introT0 == null) introT0 = now;
                const p = (now - introT0) / (INTRO * 1000);
                if (p >= 1) introDone = true; else { fb = 4 * K.U * (1 - smooth(p)); a = smooth(p); }
            } else introDone = true;
            if (!reduced()) fb = Math.max(fb, (state && state.blur) || 0);
            if (canvas.style.filter) canvas.style.filter = '';
            if (fb > 0.05 || a < 1) {
                ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
                if (fb > 0.05) {
                    const d = canvas.width / (canvas.clientWidth || canvas.width);
                    soft = soft || document.createElement('canvas'); if (soft.width !== canvas.width || soft.height !== canvas.height) { soft.width = canvas.width; soft.height = canvas.height; }
                    const sx = soft.getContext('2d'); sx.clearRect(0, 0, soft.width, soft.height); sx.drawImage(canvas, 0, 0);
                    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.filter = `blur(${(fb * d).toFixed(2)}px)`; ctx.drawImage(soft, 0, 0); ctx.filter = 'none';
                }
                if (a < 1) { ctx.globalCompositeOperation = 'destination-in'; ctx.globalAlpha = 1; ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
                ctx.restore();
            }
        };
        const awake = (now) => !reduced() && touched && now < awakeUntil;
        const probe = document.createElement('i'); probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; (canvas.parentNode || document.body).appendChild(probe);   // colours as seen where the figure sits
        const resolve = (v) => { probe.style.color = v; return getComputedStyle(probe).color; };
        const colors = () => { C = { ink: resolve('var(--ink)'), ink2: resolve('var(--ink-2)'), ink3: resolve('var(--ink-3)'), hair: resolve('var(--hair)'), accent: resolve('var(--accent)'), bg: resolve('var(--bg)') }; };
        const resize = () => {
            const box = opts.size ? opts.size() : canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
            if (state && box.width === W && box.height === H && canvas.width === Math.round(W * dpr)) return;   // nothing changed: the figure (and its training) stays
            W = box.width; H = box.height;
            if (opts.size) { canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; }
            canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            R = regionFn(W, H, fig); const hov = state && state.hover; if (state) { state.disposed = true; fig.dispose?.(state); } state = fig.init(R, rand); state.touched = touched; state.hover = hov;
            state.request = () => { if (!raf && visible && !dead) raf = requestAnimationFrame(frame); };   // a figure fed from elsewhere (a worker) asks for a frame
        };
        let dead = false;
        const frame = (now) => {
            raf = 0; if (!visible || dead) return;
            const fs0 = performance.now();
            ctx.clearRect(0, 0, W, H);
            state.__labels = [];                              // labels placed this frame (no two overlap)
            fig.draw(ctx, R, (now - t0) / 1000, C, state, still(), rand);
            if (state.wake) { awakeUntil = Math.max(awakeUntil, now + state.wake * 1000); state.wake = 0; }
            ctx.globalAlpha = 1;
            if (R.fadeFrom != null) {                       // fade into the ground instead of a hard edge
                const g = ctx.createLinearGradient(R.fadeFrom, 0, R.fadeTo, 0);
                g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
                ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
                ctx.globalCompositeOperation = 'source-over';
            }
            if (R.fadeY) {                                  // and at the top and bottom
                const [y0, y1, band] = R.fadeY, g = ctx.createLinearGradient(0, y0, 0, y1), b = band / (y1 - y0);
                g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(b, 'rgba(0,0,0,1)'); g.addColorStop(1 - b, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
                ctx.globalCompositeOperation = 'source-over';
            }
            reveal(now);
            if (root.dataset?.figperf) performance.measure('fig-frame', { start: fs0, end: performance.now() });   // dev: frame cost, opt-in via data-figperf on <html>
            if ((!still() && (!opts.staticUntilTouched || awake(now))) || !introDone) raf = requestAnimationFrame(frame);
        };
        const start = () => { if (dead) return; colors(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
        const onResize = () => { if (dead) return; resize(); start(); };
        // out of sight (a hidden tab, scrolled away, the page put away in the back-forward cache): the figure lets its
        // background work go (fig.away), and may take it up again when seen (fig.back)
        let wasAway = false;
        const sight = () => { const away = document.hidden || !visible || pageHidden; if (away !== wasAway && state) { if (away) fig.away?.(state); else fig.back?.(state); } wasAway = away; };
        let pageHidden = false;
        const onVis = () => sight(), onHide = () => { pageHidden = true; sight(); }, onShow = () => { pageHidden = false; sight(); };
        document.addEventListener('visibilitychange', onVis); addEventListener('pagehide', onHide); addEventListener('pageshow', onShow);
        const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sight(); if (visible) start(); }); io.observe(canvas);
        const mo = new MutationObserver(start); mo.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
        addEventListener('resize', onResize);
        document.fonts?.ready.then(onResize);
        resize(); start();
        return {
            // the page is left (router.js): the figure stops and lets go of everything it listens to
            destroy() { dead = true; cancelAnimationFrame(raf); raf = 0; if (state) { state.disposed = true; fig.dispose?.(state); } document.removeEventListener('visibilitychange', onVis); removeEventListener('pagehide', onHide); removeEventListener('pageshow', onShow); io.disconnect(); mo.disconnect(); removeEventListener('resize', onResize); probe.remove(); },
            // the reader touched the figure: it comes alive and takes the accent
            touch() { if (touched) return; touched = true; state.touched = true; state.hold = true; t0 = performance.now(); },
            // each interaction wakes the figure for as long as it asks (state.wake), then it comes to rest
            pointer(type, x, y, buttons) {
                if (type === 'enter' || type === 'leave') state.hover = type === 'enter';   // figures show their labels while hovered
                if (fig.pointer) fig.pointer(type, x, y, state, R, buttons);
                if (touched) awakeUntil = Math.max(awakeUntil, performance.now() + 600);
                if (!raf) start();
            },
            get touched() { return touched; },
        };
    }

    window.TufaFigures = { F, mount, DEVICE };
})();
