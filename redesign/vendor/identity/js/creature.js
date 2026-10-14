// The creature, alive: a small procedural animal that walks upright and never turns: left or right along its ground,
// and up or down the page as a sideways step (from its point of view). Each leg is two bones (hip-knee, knee-foot)
// solved by inverse kinematics; feet are planted on the page and step when they fall behind, drift in under the hip or
// stretch too far, swinging round the hip in an arc, never with a neighbour. The body follows its target on a spring,
// never faster than its legs can carry it. Behaviour: far, it watches you; nearer, it shies; close, it escapes away from
// you to the edge of its ground and tucks only when cornered; come round it, or leave it room, and it runs for the other
// side. Left alone, it walks back home and stays there.
//
//   TufaCreature.mount(svg, { ground, dashCap, homeNear, persist })   one mark (mark/mark.svg, inline) comes alive
//     ground(mark, rect, k) → { cx, cy, rx, ry, box }   its ground, measured every frame, in the mark's units (k: units
//                         per screen px); default: an ellipse around home. box: a rectangle, slid along at its walls
//     dashCap             out of a corner it runs at most this many body widths (default: to the far side)
//     homeNear            it walks home as soon as the pointer has left home (default: only when the pointer is far)
//     persist             a sessionStorage key: leaving the page it saves where it is and what it is doing, and a page
//                         opened within 5 s carries on from there (the same animal on every page)
//   TufaCreature.track(selector)   every matching mark not yet alive comes alive; marks no longer in the page are let go
//   TufaCreature.marks             the live marks (their state, for a page that shows or records them)
//
// It lives where there is a pointer to react to (hover), also under the system's reduced motion; html.no-motion stills it.
window.TufaCreature = (() => {
    const off = () => document.documentElement.classList.contains('no-motion') || !matchMedia('(hover: hover)').matches;
    const tau = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tau')) || 120) / 1000;
    const NS = 'http://www.w3.org/2000/svg', num = (el, a) => parseFloat(el.getAttribute(a)), pt = (s) => s.split(' ').map(Number);
    const ease = (t) => t * t * (3 - 2 * t), len = (v) => Math.hypot(v[0], v[1]), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    let blurN = 0;   // motion-blur filters made so far (their ids)
    const group = (svg, cls, kids, before) => { const g = document.createElementNS(NS, 'g'); g.setAttribute('class', cls); svg.insertBefore(g, before || null); kids.forEach((k) => k && g.appendChild(k)); return g; };
    const rig = (svg) => {
        const W = svg.viewBox.baseVal.width, H = svg.viewBox.baseVal.height;
        const legsG = svg.querySelector(':scope > .m-legs');
        const hindG = svg.querySelector(':scope > .m-hind');                                  // behind the body, rigged like the legs
        const back = group(svg, 'm-torso m-torso-back', [svg.querySelector(':scope > .m-body')], legsG);
        const front = group(svg, 'm-torso m-torso-front', [...svg.querySelectorAll(':scope > .m-eye')]);
        const creature = group(svg, 'm-creature', [hindG, back, legsG, front]);
        // motion blur: each bone sits in two counter-turned groups with the blur between them, so the blur runs along the
        // bone's own motion (an SVG blur is otherwise round, or along the axes); while a bone is still, no filter at all
        const defs = svg.querySelector(':scope > defs') || svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild);
        const blurrable = (el) => {
            const id = `tufa-mb-${++blurN}`, f = document.createElementNS(NS, 'filter'), blur = document.createElementNS(NS, 'feGaussianBlur');
            f.id = id; f.setAttribute('x', '-50%'); f.setAttribute('y', '-50%'); f.setAttribute('width', '200%'); f.setAttribute('height', '200%');
            blur.setAttribute('stdDeviation', '0 0'); f.append(blur); defs.append(f);
            const [outer, mid, inner] = [0, 0, 0].map(() => document.createElementNS(NS, 'g'));
            el.replaceWith(outer); outer.append(mid); mid.append(inner); inner.append(el);
            return { outer, mid, inner, blur, id, on: false, prev: null };
        };
        const rigLeg = (g) => {
            const hip = pt(g.dataset.hip), knee = pt(g.dataset.knee), foot = pt(g.dataset.foot);
            const L1 = Math.hypot(knee[0] - hip[0], knee[1] - hip[1]), L2 = Math.hypot(foot[0] - knee[0], foot[1] - knee[1]);
            const bend = Math.sign((knee[0] - hip[0]) * (foot[1] - hip[1]) - (knee[1] - hip[1]) * (foot[0] - hip[0])) || 1;
            const up = g.querySelector('.m-leg-up'), lo = g.querySelector('.m-leg-lo');
            return { up, lo, mbUp: blurrable(up), mbLo: blurrable(lo), kc: g.querySelector('.m-knee'), hip, knee, foot, L1, L2, bend,
                     a1: Math.atan2(knee[1] - hip[1], knee[0] - hip[0]), a2: Math.atan2(foot[1] - knee[1], foot[0] - knee[0]),
                     Fw: null, step: null, rest: Math.hypot(foot[0] - hip[0], foot[1] - hip[1]) };
        };
        // two chains: the five legs (neighbours never step together), and the two hind legs (never together)
        const front5 = [...legsG.querySelectorAll('.m-leg[data-hip]')].map(rigLeg), hind2 = hindG ? [...hindG.querySelectorAll('.m-leg[data-hip]')].map(rigLeg) : [];
        [front5, hind2].forEach((chain) => chain.forEach((l, i) => { l.prev = chain[i - 1]; l.next = chain[i + 1]; }));
        hind2.forEach((l) => { l.hind = true; l.lift = null; l.lifted = 0; });   // arching over the back: they ride with the body (see the feet)
        const legs = [...hind2, ...front5];
        const eyes = [...front.querySelectorAll('.m-eye')].map((e) => { const w = e.querySelector('.m-white'), p = e.querySelector('.m-pupil');
            return { p, W: { x: num(w, 'cx'), y: num(w, 'cy'), r: num(w, 'r') }, rest: { x: num(p, 'cx'), y: num(p, 'cy') }, now: { x: num(p, 'cx'), y: num(p, 'cy') }, reach: num(w, 'r') - num(p, 'r') * 0.6 }; });
        // its ground: an ellipse around home, unless the page measures one (opts.ground)
        const area = { cx: 0, cy: 0, rx: 0.42 * W, ry: 0.26 * H };
        return { svg, creature, back, front, legs, eyes, W, H, area, opts: {},
                 p: [0, 0], v: [0, 0], target: [0, 0], duck: 0, tduck: 0, tilt: 0, bob: 0, shy: 0, mode: 'free', lastNear: -1e9 };
    };
    let marks = [];
    // the creature's frame: it never turns, so its own coordinates are the page's, shifted by where it stands
    const toWorld = (m, q) => [m.p[0] + q[0], m.p[1] + q[1]];
    const toLocal = (m, w) => [w[0] - m.p[0], w[1] - m.p[1]];
    const edge = (m, from, dir) => {   // the farthest point of its ground from `from` along `dir`
        const A = m.area;
        if (A.box) {   // a rectangle: along `dir`, but blocked sides are dropped first, so at a wall it slides along it instead of stopping
            const lo = [A.cx - A.rx, A.cy - A.ry], hi = [A.cx + A.rx, A.cy + A.ry], e = 0.01 * m.W, d = [...dir];
            for (const i of [0, 1]) if ((d[i] < 0 && from[i] <= lo[i] + e) || (d[i] > 0 && from[i] >= hi[i] - e)) d[i] = 0;
            const L = len(d); if (!L) return [...from];
            let t = Infinity; for (const i of [0, 1]) { d[i] /= L; if (d[i] > 1e-6) t = Math.min(t, (hi[i] - from[i]) / d[i]); if (d[i] < -1e-6) t = Math.min(t, (lo[i] - from[i]) / d[i]); }
            t = Math.max(0, t); return [from[0] + d[0] * t, from[1] + d[1] * t];
        }
        if (A.ry === 0) { const t = dir[0] > 0 ? (A.cx + A.rx - from[0]) : (A.cx - A.rx - from[0]); return [from[0] + t, 0]; }
        const ox = (from[0] - A.cx) / A.rx, oy = (from[1] - A.cy) / A.ry, dx = dir[0] / A.rx, dy = dir[1] / A.ry;
        const a = dx * dx + dy * dy, b = 2 * (ox * dx + oy * dy), cc = ox * ox + oy * oy - 1, t = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * cc))) / (2 * a || 1);
        return [from[0] + dir[0] * t, from[1] + dir[1] * t];
    };
    let px = null, py = null, raf = 0, last = 0;
    const tick = (now) => {
        raf = 0; const dt = Math.min(0.04, (now - (last || now)) / 1000); last = now; let busy = false;
        for (const m of marks) {
            const r = m.svg.getBoundingClientRect(); if (!r.width) continue;
            const W = m.W, H = m.H, k = W / r.width, S = r.width;
            if (m.opts.ground) Object.assign(m.area, m.opts.ground(m, r, k));   // a ground the page measures, live
            const center = toWorld(m, [W * 0.5, H * 0.55]);
            const here = [r.left + center[0] / k, r.top + center[1] / k];
            const dv = px == null ? [0, 0] : [px - here[0], py - here[1]], d = px == null ? Infinity : len(dv);
            const near = Math.max(60, S * 0.75), far = Math.max(200, S * 2.2);
            let away = d ? [-dv[0] / d, -dv[1] / d] : [1, 0]; if (m.area.ry === 0) away = [away[0] >= 0 ? 1 : -1, 0];
            if (d < near * 0.35 && m.away && m.mode !== 'cornered') away = m.away;   // the pointer right on top of it: keep fleeing the way it was going (cornered, it looks for the open side)
            m.away = away;
            // ── behaviour ──
            const atP = (q) => len([q[0] - m.p[0], q[1] - m.p[1]]) < 0.04 * W;
            m.shy = 0;
            if (m.mode === 'dash' && (d < near * 0.8 || atP(m.target) || now - m.dashAt > 1500)) m.mode = 'free';   // a dash ends there, after a moment, or when you come close again
            if (m.mode === 'dash') {}
            else if (d < near) {
                m.lastNear = now; const e = edge(m, m.p, away);
                // cornered until there is real room to run (not a sliver it would dart into and stop again)
                const was = m.mode, room = len([e[0] - m.p[0], e[1] - m.p[1]]);
                m.mode = room < (was === 'cornered' ? 0.15 : 0.04) * W ? 'cornered' : 'flee'; m.target = e;
                if (m.mode === 'flee' && was === 'free') m.flinch = 1;   // coming close: it starts away at once (from rest, not out of a corner)
            } else {
                if (m.mode === 'cornered' && d > near * 1.15) { m.mode = 'dash'; m.dashAt = now; const back2 = [-(m.p[0] - m.area.cx), -(m.p[1] - m.area.cy)], L = len(back2) || 1; m.target = edge(m, [m.area.cx, m.area.cy], [back2[0] / L, back2[1] / L]);
                    if (m.opts.dashCap) { const t = [m.target[0] - m.p[0], m.target[1] - m.p[1]], tl = len(t), cap = m.opts.dashCap * W; if (tl > cap) m.target = [m.p[0] + t[0] * cap / tl, m.p[1] + t[1] * cap / tl]; } }   // a few body widths out of the corner, not the whole ground
                else if (m.mode === 'flee') { m.mode = 'free'; m.target = [m.p[0] + m.v[0] * 0.25, m.p[1] + m.v[1] * 0.25]; }
                if (d < far && m.mode === 'free') m.shy = 1 - (d - near) / (far - near);
                const homeD = px == null ? Infinity : len([px - (r.left + W * 0.5 / k), py - (r.top + H * 0.55 / k)]);   // the pointer's distance from its home
                if (m.mode === 'free' && now - m.lastNear > 1500 && (d >= far || (m.opts.homeNear && homeD > near * 1.4))) {
                    m.target = [0, 0];   // left alone: back home, and stays there
                }
            }
            m.tduck = m.mode === 'cornered' ? 1 : 0;
            // ── body: a 2D spring towards the target, capped at its pace ──
            const kS = m.mode === 'flee' || m.mode === 'dash' ? 70 : 26, cS = 2 * Math.sqrt(kS) * 0.85, pace = (pxs) => clamp(pxs / S, 0.3, 1.25) * W;   // a pace in screen px/s, as body widths: small creatures cover more of their length, but never more than their legs can carry
            // the body never outruns its feet: the more a planted foot is stretched behind it, the slower it goes
            const vmax = pace(m.mode === 'dash' ? 125 : m.mode === 'flee' ? 100 : 60) * clamp(1 - ((m.strain || 0) - 1.02) * 3, 0.15, 1);
            if (m.flinch) { m.v = [m.v[0] + away[0] * vmax * 0.35, m.v[1] + away[1] * vmax * 0.35]; m.flinch = 0; }   // the flinch: off at once
            for (const i of [0, 1]) m.v[i] += (kS * (m.target[i] - m.p[i]) - cS * m.v[i]) * dt;
            const sp = len(m.v); if (sp > vmax) { m.v = [m.v[0] * vmax / sp, m.v[1] * vmax / sp]; }
            m.p = [m.p[0] + m.v[0] * dt, m.p[1] + m.v[1] * dt];
            { const A = m.area;   // never beyond its ground: hold it at the edge and drop any speed outwards
              if (A.box) { for (const i of [0, 1]) { const c = i ? A.cy : A.cx, r2 = i ? A.ry : A.rx; if (m.p[i] < c - r2 || m.p[i] > c + r2) { m.p[i] = clamp(m.p[i], c - r2, c + r2); m.v[i] = 0; } } }
              else if (A.ry === 0) { const lo = A.cx - A.rx, hi = A.cx + A.rx; if (m.p[0] < lo || m.p[0] > hi) { m.p[0] = clamp(m.p[0], lo, hi); m.v[0] = 0; } m.p[1] = 0; m.v[1] = 0; }
              else { const ex = (m.p[0] - A.cx) / A.rx, ey = (m.p[1] - A.cy) / A.ry, e2 = Math.hypot(ex, ey); if (e2 > 1) { m.p = [A.cx + ex / e2 * A.rx, A.cy + ey / e2 * A.ry]; const n = [ex / A.rx, ey / A.ry], nl = Math.hypot(n[0], n[1]) || 1, vn = (m.v[0] * n[0] + m.v[1] * n[1]) / nl; if (vn > 0) m.v = [m.v[0] - vn * n[0] / nl, m.v[1] - vn * n[1] / nl]; } } }
            const speed = len(m.v) / W;
            m.duck += (m.tduck - m.duck) * Math.min(1, dt * 10);
            m.tilt += ((m.shy ? -m.shy * 3 : 0) - m.tilt) * Math.min(1, dt * 24);   // leaning away is quick
            // ── feet: planted on the page; in the creature's frame they slide back as it moves; far behind → step ──
            const vloc = m.v;   // its velocity, in its own frame (it never turns, so the page's)
            let stepping = m.legs.filter((l) => l.step).length, liftSum = 0;
            const stretch = (l) => { if (!l.Fw) return 0; const q = toLocal(m, l.Fw), r2 = len([q[0] - l.hip[0], q[1] - l.hip[1]]); return r2 < 0.55 * l.rest ? 2 : r2 / Math.max(l.L1 + l.L2, l.rest); };   // too far, or in under the hip: first
            for (const l of [...m.legs].sort((a, b) => stretch(b) - stretch(a))) {   // the most stretched leg gets the next step
                if (!l.Fw) { l.Fw = toWorld(m, l.foot); l.step = null; continue; }   // first frame: feet where they are drawn
                if (l.hind) {   // the hind legs arch over the back, on nothing: their feet ride with the body, trailing a little on a
                    // spring while it moves and lifting in turn with the steps of the legs below, on the same clock (never planted,
                    // so never stretched or turned round)
                    const tr = (() => { const o = [-vloc[0] * 0.06, -vloc[1] * 0.06], ol = len(o), cap = 0.2 * l.rest; return ol > cap ? [o[0] * cap / ol, o[1] * cap / ol] : o; })();
                    l.Fh = l.Fh || toLocal(m, l.Fw); const kk = Math.min(1, dt * 12);
                    l.Fh = [l.Fh[0] + (l.foot[0] + tr[0] - l.Fh[0]) * kk, l.Fh[1] + (l.foot[1] + tr[1] - l.Fh[1]) * kk];
                    let lift = 0;
                    if (l.lift) { l.lift.t += dt / l.lift.dur; if (l.lift.t >= 1) l.lift = null; else lift = Math.sin(Math.PI * l.lift.t) * 0.035 * W; }
                    l.Fw = toWorld(m, [l.Fh[0], l.Fh[1] - lift]);
                    continue;
                }
                const lead = (k, cap) => { const o = [vloc[0] * k, vloc[1] * k], ol = len(o); return ol > cap ? [o[0] * cap / ol, o[1] * cap / ol] : o; };   // ahead in its direction, at most a part of its own reach
                const h0 = lead(0.07, 0.25 * l.rest), home = [l.foot[0] + h0[0], l.foot[1] + h0[1]];   // ahead in whichever direction it goes (up and down: a sideways step)
                if (!l.step) {
                    const Fl = toLocal(m, l.Fw), err = Math.hypot(Fl[0] - home[0], Fl[1] - home[1]), reach = Math.hypot(Fl[0] - l.hip[0], Fl[1] - l.hip[1]);
                    const need = speed > 0.02 ? Math.min(Math.max(0.07 * W, speed * 0.25 * W), 0.5 * l.rest) :   // a stride in proportion to the leg: a short leg steps before its foot passes under its hip
                                  (speed > 0.004 ? 0.03 * W : 0.012 * W);   // faster: longer strides (few legs in the air at once, each foot down for most of its stride)
                    const calm = stepping < 2 && !(l.prev && l.prev.step) && !(l.next && l.next.step);
                    const span = Math.max(l.L1 + l.L2, l.rest), full = reach > span + 0.05 * W;   // stretched well past its resting reach: it steps now, whatever the others are doing
                    const close = reach < Math.max(0.55 * l.rest, Math.abs(l.L1 - l.L2) * 1.5);   // or its foot drifting in under its hip (the knee would spin round): the same
                    if ((err > need && calm) || (reach > l.rest + 0.03 * W && stepping < 3) || full || close) {   // too far, or in under the hip: now, whatever the others are doing
                        if (reach > span) { const s3 = span / reach; l.Fw = toWorld(m, [l.hip[0] + (Fl[0] - l.hip[0]) * s3, l.hip[1] + (Fl[1] - l.hip[1]) * s3]); }   // never from beyond its reach
                        const h1 = lead(0.17, 0.4 * l.rest); let toL = [l.foot[0] + h1[0], l.foot[1] + h1[1]];
                        { const o = [toL[0] - l.hip[0], toL[1] - l.hip[1]], ol = len(o), cap = Math.max(span * 0.92, l.rest); if (ol > cap) toL = [l.hip[0] + o[0] * cap / ol, l.hip[1] + o[1] * cap / ol]; }   // a foot lands within easy reach (or at its resting spot), never at full stretch
                        const swing = Math.hypot(toL[0] - Fl[0], toL[1] - Fl[1]), vs = Math.max(len(m.v), 0.4 * W);   // a step takes as long as its swing needs (the foot ~1.2× the body's pace): a visible swing, never a flick
                        l.step = { t: 0, from: [...l.Fw], toL, dur: clamp(swing / (1.2 * vs), 1.5 * tau, 3 * tau) };
                        stepping++;
                        // walking, a hind leg lifts with it, for as long (the one that lifted longest ago; never both at once)
                        if (speed > 0.02) { const hs = m.legs.filter((h) => h.hind); if (!hs.some((h) => h.lift)) { const h = hs.sort((a, b) => a.lifted - b.lifted)[0]; if (h) { h.lift = { t: 0, dur: l.step.dur }; h.lifted = now; } } }
                    }
                }
                if (l.step) {
                    l.step.t += dt / l.step.dur; const t = Math.min(1, l.step.t), e = ease(t), lift = Math.sin(Math.PI * t) * 0.05 * W;
                    const to = toWorld(m, l.step.toL), up = [0, -lift];   // lift: up from the ground
                    // the foot swings round its hip (angle and distance eased), never through it: a straight path past the hip spun the knee
                    const fL = toLocal(m, l.step.from), af = Math.atan2(fL[1] - l.hip[1], fL[0] - l.hip[0]), at = Math.atan2(l.step.toL[1] - l.hip[1], l.step.toL[0] - l.hip[0]);
                    const da = ((at - af + 3 * Math.PI) % (2 * Math.PI)) - Math.PI, rf = len([fL[0] - l.hip[0], fL[1] - l.hip[1]]), rt = len([l.step.toL[0] - l.hip[0], l.step.toL[1] - l.hip[1]]);
                    const ang2 = af + da * e, rr = Math.max(0.55 * l.rest, rf + (rt - rf) * e), sw = toWorld(m, [l.hip[0] + rr * Math.cos(ang2), l.hip[1] + rr * Math.sin(ang2)]);
                    let q = [sw[0] + up[0] - m.p[0] - l.hip[0], sw[1] + up[1] - m.p[1] - l.hip[1]]; const ql = len(q), qmin = 0.55 * l.rest;
                    if (ql < qmin) q = ql ? [q[0] * qmin / ql, q[1] * qmin / ql] : [0, -qmin];   // the lift never brings the foot in under the hip
                    l.Fw = [m.p[0] + l.hip[0] + q[0], m.p[1] + l.hip[1] + q[1]];
                    liftSum += Math.sin(Math.PI * t);
                    if (t >= 1) { l.Fw = to; l.step = null; }
                }
            }
            m.strain = Math.max(0, ...m.legs.filter((l) => !l.step && l.Fw && !l.hind).map((l) => { const q = toLocal(m, l.Fw); return len([q[0] - l.hip[0], q[1] - l.hip[1]]) / Math.max(l.L1 + l.L2, l.rest); }));
            // ── torso: bob with lifted legs, crouch, lean ──
            m.bob += ((liftSum ? -0.012 * W : 0) - m.bob) * Math.min(1, dt * 14);
            const by = m.bob + m.duck * 0.085 * W, tilt = m.tilt - m.duck * 3, pv = [W * 0.5, H * 0.5];
            const torsoT = `translate(0 ${by.toFixed(1)}) rotate(${tilt.toFixed(2)} ${pv[0]} ${pv[1]})`;
            m.back.setAttribute('transform', torsoT); m.front.setAttribute('transform', torsoT);
            const rot = (q) => { const a = tilt * Math.PI / 180, c = Math.cos(a), s2 = Math.sin(a), x = q[0] - pv[0], y = q[1] - pv[1]; return [pv[0] + x * c - y * s2, pv[1] + x * s2 + y * c + by]; };
            // a bone's blur: along its motion on the page, as long as ~10 ms of it (a camera's shutter); none while it is still
            const blur = (b, mid) => {
                const w = [mid[0] + m.p[0], mid[1] + m.p[1]], v = b.prev && dt > 0 ? [(w[0] - b.prev[0]) / dt, (w[1] - b.prev[1]) / dt] : [0, 0]; b.prev = w;
                const sd = Math.min(0.05 * W, len(v) * 0.010);
                if (sd < 0.004 * W) { if (b.on) { b.mid.removeAttribute('filter'); b.outer.removeAttribute('transform'); b.inner.removeAttribute('transform'); b.on = false; } return; }
                const a = Math.atan2(v[1], v[0]) * 180 / Math.PI, c = `${mid[0].toFixed(0)} ${mid[1].toFixed(0)}`;
                b.outer.setAttribute('transform', `rotate(${a.toFixed(1)} ${c})`); b.inner.setAttribute('transform', `rotate(${(-a).toFixed(1)} ${c})`);
                b.blur.setAttribute('stdDeviation', `${sd.toFixed(1)} 0`);
                if (!b.on) { b.mid.setAttribute('filter', `url(#${b.id})`); b.on = true; }
            };
            // ── legs: two-bone IK in its frame ──
            for (const l of m.legs) {
                const H2 = rot(l.hip), F = !l.Fw ? l.foot : toLocal(m, l.Fw); let vx = F[0] - H2[0], vy = F[1] - H2[1], dd = Math.hypot(vx, vy);
                const dmax = l.L1 + l.L2 - 0.5, dmin = Math.abs(l.L1 - l.L2) + 0.5; if (dd > dmax) { const s3 = dmax / dd; vx *= s3; vy *= s3; dd = dmax; } if (dd < dmin) { const s3 = dmin / (dd || 1); vx *= s3; vy *= s3; dd = dmin; }
                // a foot almost on its hip gives the leg no direction (it would spin round): it keeps the one it had
                const keep = dd < 1.3 * dmin && l.dir != null, a = keep ? l.dir : Math.atan2(vy, vx);
                if (keep) { vx = Math.cos(a) * dd; vy = Math.sin(a) * dd; } l.dir = a;
                const b = Math.acos(clamp((l.L1 * l.L1 + dd * dd - l.L2 * l.L2) / (2 * l.L1 * dd), -1, 1));
                const a1 = a - l.bend * b, K = [H2[0] + l.L1 * Math.cos(a1), H2[1] + l.L1 * Math.sin(a1)], Fp = [H2[0] + vx, H2[1] + vy];
                const a2 = Math.atan2(Fp[1] - K[1], Fp[0] - K[0]), deg = 180 / Math.PI;
                l.up.setAttribute('transform', `translate(${(H2[0] - l.hip[0]).toFixed(1)} ${(H2[1] - l.hip[1]).toFixed(1)}) rotate(${((a1 - l.a1) * deg).toFixed(2)} ${l.hip[0]} ${l.hip[1]})`);
                l.lo.setAttribute('transform', `translate(${(K[0] - l.knee[0]).toFixed(1)} ${(K[1] - l.knee[1]).toFixed(1)}) rotate(${((a2 - l.a2) * deg).toFixed(2)} ${l.knee[0]} ${l.knee[1]})`);
                l.kc.setAttribute('cx', K[0].toFixed(1)); l.kc.setAttribute('cy', K[1].toFixed(1));
                blur(l.mbUp, [(H2[0] + K[0]) / 2, (H2[1] + K[1]) / 2]); blur(l.mbLo, [(K[0] + Fp[0]) / 2, (K[1] + Fp[1]) / 2]);
            }
            // ── the whole creature ──
            m.creature.setAttribute('transform', `translate(${m.p[0].toFixed(1)} ${m.p[1].toFixed(1)})`);
            // ── eyes: towards the pointer, in the eyes' own frame ──
            const ctm = m.front.getScreenCTM(), q = px == null || !ctm ? null : new DOMPoint(px, py).matrixTransform(ctm.inverse());
            const fe = Math.max(0, Math.min(1, (far * 1.3 - d) / (far * 1.3 - near * 0.5)));
            for (const e of m.eyes) {
                let tx = e.rest.x, ty = e.rest.y;
                if (q && fe > 0) { const ex = q.x - e.W.x, ey = q.y - e.W.y, L = Math.hypot(ex, ey) || 1, kk = Math.min(1, L / e.W.r), s4 = ease(fe);
                    tx = e.rest.x + (e.W.x + (ex / L) * e.reach * kk - e.rest.x) * s4; ty = e.rest.y + (e.W.y + (ey / L) * e.reach * kk - e.rest.y) * s4; }
                e.now.x += (tx - e.now.x) * 0.25; e.now.y += (ty - e.now.y) * 0.25; e.p.setAttribute('cx', e.now.x.toFixed(1)); e.p.setAttribute('cy', e.now.y.toFixed(1));
                if (Math.abs(tx - e.now.x) + Math.abs(ty - e.now.y) > 0.3) busy = true;
            }
            const restless = speed > 0.002 || len([m.target[0] - m.p[0], m.target[1] - m.p[1]]) > 0.003 * W || m.legs.some((l) => l.step) || Math.abs(m.tduck - m.duck) > 0.004 || Math.abs(m.bob) > 0.3 || m.legs.some((l) => l.mbUp.on || l.mbLo.on || l.lift || (l.Fh && Math.hypot(l.Fh[0] - l.foot[0], l.Fh[1] - l.foot[1]) > 0.002 * W));
            if (restless || d < far * 1.3 || len(m.p) > 0.003 * W) busy = true;   // away from home: stay awake to walk back
        }
        if (busy) raf = requestAnimationFrame(tick); else last = 0;
    };
    const wake = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(tick); };   // hidden pages draw nothing: wait until shown
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { raf = 0; last = 0; wake(); } });
    // persistence (opts.persist): leaving, a mark saves where it is and what it is doing (and where the pointer was); a page
    // opened within 5 s restores it and draws it at once, so it carries on mid-step instead of starting over
    const save = (m) => { try { sessionStorage.setItem(m.opts.persist, JSON.stringify({ t: Date.now(), px, py, p: m.p, v: m.v, target: m.target, mode: m.mode, duck: m.duck, tilt: m.tilt, bob: m.bob, away: m.away,
        near: Date.now() - (performance.now() - m.lastNear), feet: m.legs.map((l) => (l.Fw ? toLocal(m, l.Fw) : null)), eyes: m.eyes.map((e) => [e.now.x, e.now.y]) })); } catch (e) {} };
    const restore = (m) => { try {
        const st = JSON.parse(sessionStorage.getItem(m.opts.persist) || 'null'); if (!st || Date.now() - st.t > 5000) return;
        Object.assign(m, { p: st.p, v: st.v, target: st.target, mode: st.mode, duck: st.duck, tilt: st.tilt, bob: st.bob, away: st.away, dashAt: performance.now(), lastNear: performance.now() - (Date.now() - st.near) });
        m.legs.forEach((l, i) => { if (st.feet[i]) l.Fw = toWorld(m, st.feet[i]); });
        m.eyes.forEach((e, i) => { if (st.eyes[i]) { e.now.x = st.eyes[i][0]; e.now.y = st.eyes[i][1]; } });
        if (st.px != null) { px = st.px; py = st.py; }
    } catch (e) {} };
    addEventListener('pagehide', () => marks.forEach((m) => m.opts.persist && save(m)));
    addEventListener('resize', () => { if (!raf) { tick(performance.now()); last = 0; } });
    const mount = (svg, opts = {}) => {
        if (!svg || off() || !svg.querySelector('.m-leg[data-hip]')) return null;
        const had = marks.find((m) => m.svg === svg); if (had) return had;
        const m = rig(svg); m.opts = opts; if (opts.persist) restore(m);
        marks.push(m); last = 0; tick(performance.now()); wake();   // one frame now, before the first paint
        return m;
    };
    const track = (selector) => {
        marks = marks.filter((m) => m.svg.isConnected);
        document.querySelectorAll(selector).forEach((svg) => mount(svg));
        if (!raf) { tick(performance.now()); last = 0; } wake();
    };
    addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return; px = e.clientX; py = e.clientY; wake(); }, { passive: true });
    document.addEventListener('pointerleave', () => { px = py = null; wake(); });
    addEventListener('blur', () => { px = py = null; wake(); });
    addEventListener('scroll', wake, { passive: true });
    wake();
    return { mount, track, wake, get marks() { return marks; } };   // marks: the live ones (for a page that shows them)
})();
