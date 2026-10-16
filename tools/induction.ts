// The attention figure's trainer (site/assets/js/figures.js, F.attnpat), in WebAssembly: a two-layer attention-only
// transformer, one head per layer, trained with Adam on repeated random sequences (an induction task). The same model as
// the figure's JavaScript fallback, written without allocation: parameters in one array, activations kept for backward.
// Build: npx -p assemblyscript asc tools/induction.ts -O3 --runtime stub --uncheckedBehavior always --enable simd -o - | base64
//        → INDUCTION_WASM in figures.js
const T = 20, V = 16, D = 32, DH = 16, L = 2, B = 16;
const oE = 0, oP = oE + V * D, oU = oP + T * D, oL = oU + D * V, LS = 3 * D * DH + DH * D, N = oL + L * LS;
const th = new StaticArray<f32>(N), gr = new StaticArray<f32>(N), mo = new StaticArray<f32>(N), ve = new StaticArray<f32>(N);
const hs = new StaticArray<f32>((L + 1) * T * D), Q = new StaticArray<f32>(L * T * DH), K = new StaticArray<f32>(L * T * DH), Vv = new StaticArray<f32>(L * T * DH), O = new StaticArray<f32>(L * T * DH);
const AA = new StaticArray<f32>(L * T * T), M = new StaticArray<u8>(T * T), disp = new StaticArray<i32>(T);
const lg = new StaticArray<f32>(T * V), dlg = new StaticArray<f32>(T * V), dh = new StaticArray<f32>(T * D), dn = new StaticArray<f32>(T * D);
const dO = new StaticArray<f32>(T * DH), dq = new StaticArray<f32>(T * DH), dk = new StaticArray<f32>(T * DH), dv = new StaticArray<f32>(T * DH), dA = new StaticArray<f32>(T);
const x = new StaticArray<i32>(T), perm = new StaticArray<i32>(V);
let s0: i32 = 1, step: i32 = 0, aL: f64 = 0, aA: f64 = 0, aN: i32 = 0, dispS: i32 = 8, lr: f32 = 0.002;
const SC: f32 = 0.25;   // 1/√DH

function rnd(): f64 { s0 = s0 + 0x6D2B79F5; let t = (s0 ^ (s0 >>> 15)) * (1 | s0); t = (t + ((t ^ (t >>> 7)) * (61 | t))) ^ t; return <f64>(<u32>(t ^ (t >>> 14))) / 4294967296.0; }
function randn(): f64 { let u = 0.0; while (u == 0.0) u = rnd(); return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * rnd()); }
function fill0(a: StaticArray<f32>): void { for (let i = 0; i < a.length; i++) a[i] = 0; }
// four lanes at a time (every inner length here, 16 or 32, is a multiple of four)
@inline function P(a: StaticArray<f32>, i: i32): usize { return changetype<usize>(a) + (<usize>i << 2); }
// y += k · x over n floats
@inline function axpy(y: usize, x: usize, k: f32, n: i32): void { const kk = f32x4.splat(k); for (let c = 0; c < n; c += 4) { const o = <usize>c << 2; v128.store(y + o, f32x4.add(v128.load(y + o), f32x4.mul(kk, v128.load(x + o)))); } }
@inline function dot(a: usize, b: usize, n: i32): f32 { let acc = f32x4.splat(0); for (let c = 0; c < n; c += 4) { const o = <usize>c << 2; acc = f32x4.add(acc, f32x4.mul(v128.load(a + o), v128.load(b + o))); } return f32x4.extract_lane(acc, 0) + f32x4.extract_lane(acc, 1) + f32x4.extract_lane(acc, 2) + f32x4.extract_lane(acc, 3); }
// y[yo..] (n×b) = x[xo..] (n×a) · th[w..] (a×b)
@inline function mm(X: StaticArray<f32>, xo: i32, w: i32, n: i32, a: i32, b: i32, Y: StaticArray<f32>, yo: i32): void {
  for (let i = 0; i < n * b; i++) Y[yo + i] = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < a; j++) axpy(P(Y, yo + i * b), P(th, w + j * b), X[xo + i * a + j], b);
}
// gr[w..] += xᵀ dY; dX += dY · Wᵀ (if dX)
@inline function mmB(X: StaticArray<f32>, xo: i32, w: i32, dY: StaticArray<f32>, n: i32, a: i32, b: i32, dX: StaticArray<f32>, useDX: bool): void {
  for (let i = 0; i < n; i++) for (let j = 0; j < a; j++) { const xv = X[xo + i * a + j], wr = w + j * b, yr = i * b; axpy(P(gr, wr), P(dY, yr), xv, b); if (useDX) dX[i * a + j] += dot(P(dY, yr), P(th, wr), b); }
}
function sample(): i32 {
  for (let i = 0; i < V; i++) perm[i] = i;
  for (let i = V - 1; i > 0; i--) { const j = <i32>Math.floor(rnd() * <f64>(i + 1)), t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  const S = 6 + <i32>Math.floor(rnd() * 5.0);
  for (let t = 0; t < T; t++) x[t] = t < S ? perm[t] : t < 2 * S ? perm[t - S] : <i32>Math.floor(rnd() * <f64>V);
  return S;
}
let fLoss: f64 = 0, fAcc: f64 = 0;
function forward(S: i32): void {
  for (let t = 0; t < T; t++) for (let c = 0; c < D; c++) hs[t * D + c] = th[oE + x[t] * D + c] + th[oP + t * D + c];
  for (let l = 0; l < L; l++) {
    const ho = l * T * D, o0 = oL + l * LS, qo = l * T * DH, ao = l * T * T;
    mm(hs, ho, o0, T, D, DH, Q, qo); mm(hs, ho, o0 + D * DH, T, D, DH, K, qo); mm(hs, ho, o0 + 2 * D * DH, T, D, DH, Vv, qo);
    for (let i = 0; i < T * T; i++) AA[ao + i] = 0; for (let i = 0; i < T * DH; i++) O[qo + i] = 0;
    for (let i = 0; i < T; i++) {
      let mx: f32 = -1e30;
      for (let j = 0; j <= i; j++) if (M[i * T + j]) { const s = dot(P(Q, qo + i * DH), P(K, qo + j * DH), DH) * SC; AA[ao + i * T + j] = s; if (s > mx) mx = s; }
      let z: f32 = 0; for (let j = 0; j <= i; j++) if (M[i * T + j]) { const e = Mathf.exp(AA[ao + i * T + j] - mx); AA[ao + i * T + j] = e; z += e; }
      for (let j = 0; j <= i; j++) { const a = AA[ao + i * T + j] / z; AA[ao + i * T + j] = a; if (a != 0) axpy(P(O, qo + i * DH), P(Vv, qo + j * DH), a, DH); }
    }
    mm(O, qo, o0 + 3 * D * DH, T, DH, D, hs, ho + T * D); for (let i = 0; i < T * D; i++) hs[ho + T * D + i] += hs[ho + i];
  }
  mm(hs, L * T * D, oU, T, D, V, lg, 0);
  let loss: f64 = 0, hit = 0; const t0 = S, t1 = 2 * S - 1, n: f32 = <f32>(t1 - t0); fill0(dlg);
  for (let t = t0; t < t1; t++) {
    let mx: f32 = -1e30, am = 0; for (let c = 0; c < V; c++) if (lg[t * V + c] > mx) { mx = lg[t * V + c]; am = c; }
    let z: f32 = 0; for (let c = 0; c < V; c++) z += Mathf.exp(lg[t * V + c] - mx);
    const y = x[t + 1]; loss -= <f64>(lg[t * V + y] - mx - Mathf.log(z)); if (am == y) hit++;
    for (let c = 0; c < V; c++) dlg[t * V + c] = (Mathf.exp(lg[t * V + c] - mx) / z - (c == y ? <f32>1 : <f32>0)) / n;
  }
  fLoss = loss / <f64>(t1 - t0); fAcc = <f64>hit / <f64>(t1 - t0);
}
function backward(): void {
  fill0(dh); mmB(hs, L * T * D, oU, dlg, T, D, V, dh, true);
  for (let l = L - 1; l >= 0; l--) {
    const ho = l * T * D, o0 = oL + l * LS, qo = l * T * DH, ao = l * T * T;
    for (let i = 0; i < T * D; i++) dn[i] = dh[i];
    fill0(dO); mmB(O, qo, o0 + 3 * D * DH, dh, T, DH, D, dO, true); fill0(dq); fill0(dk); fill0(dv);
    for (let i = 0; i < T; i++) {
      let s2: f32 = 0;
      for (let j = 0; j <= i; j++) { if (!M[i * T + j]) { dA[j] = 0; continue; } const a = AA[ao + i * T + j], s = dot(P(dO, i * DH), P(Vv, qo + j * DH), DH); axpy(P(dv, j * DH), P(dO, i * DH), a, DH); dA[j] = s; s2 += s * a; }
      for (let j = 0; j <= i; j++) { if (!M[i * T + j]) continue; const g = AA[ao + i * T + j] * (dA[j] - s2) * SC; axpy(P(dq, i * DH), P(K, qo + j * DH), g, DH); axpy(P(dk, j * DH), P(Q, qo + i * DH), g, DH); }
    }
    mmB(hs, ho, o0, dq, T, D, DH, dn, true); mmB(hs, ho, o0 + D * DH, dk, T, D, DH, dn, true); mmB(hs, ho, o0 + 2 * D * DH, dv, T, D, DH, dn, true);
    for (let i = 0; i < T * D; i++) dh[i] = dn[i];
  }
  for (let t = 0; t < T; t++) { axpy(P(gr, oE + x[t] * D), P(dh, t * D), 1, D); axpy(P(gr, oP + t * D), P(dh, t * D), 1, D); }
}
export function maskPtr(): usize { return changetype<usize>(M); }
export function dispPtr(): usize { return changetype<usize>(disp); }
export function attnPtr(): usize { return changetype<usize>(AA); }
export function setup(seed: i32, S: i32, rate: f32): void {
  s0 = seed; step = 0; aL = 0; aA = 0; aN = 0; dispS = S; lr = rate; fill0(gr); fill0(mo); fill0(ve);
  const sE = 0.5, sP = 0.5, sU = 1.0 / Math.sqrt(<f64>D), sW = 1.0 / Math.sqrt(<f64>D), sO = 1.0 / Math.sqrt(<f64>DH);
  for (let i = 0; i < V * D; i++) th[oE + i] = <f32>(randn() * sE);
  for (let i = 0; i < T * D; i++) th[oP + i] = <f32>(randn() * sP);
  for (let i = 0; i < D * V; i++) th[oU + i] = <f32>(randn() * sU);
  for (let l = 0; l < L; l++) { const o0 = oL + l * LS; for (let i = 0; i < 3 * D * DH; i++) th[o0 + i] = <f32>(randn() * sW); for (let i = 0; i < DH * D; i++) th[o0 + 3 * D * DH + i] = <f32>(randn() * sO); }
}
export function train(n: i32): void {
  for (let s = 0; s < n; s++) {
    fill0(gr); let ls: f64 = 0, ac: f64 = 0;
    for (let b = 0; b < B; b++) { forward(sample()); ls += fLoss; ac += fAcc; backward(); }
    step++;
    const b1: f32 = 0.9, b2: f32 = 0.98, c1 = <f32>(1.0 / (1.0 - Math.pow(0.9, <f64>step))), c2 = <f32>(1.0 / (1.0 - Math.pow(0.98, <f64>step))), inv: f32 = 1.0 / <f32>B;
    for (let i = 0; i < N; i++) { const g = gr[i] * inv; mo[i] = b1 * mo[i] + (1 - b1) * g; ve[i] = b2 * ve[i] + (1 - b2) * g * g; th[i] -= lr * (mo[i] * c1) / (Mathf.sqrt(ve[i] * c2) + <f32>1e-8); }
    aL += ls / <f64>B; aA += ac / <f64>B; aN++;
  }
}
// the shown sequence through the current model: both layers' attention in AA
export function show(): void { for (let t = 0; t < T; t++) x[t] = disp[t]; forward(dispS); }
export function steps(): i32 { return step; }
export function meanLoss(): f64 { const v = aN ? aL / <f64>aN : -1.0; return v; }
export function meanAcc(): f64 { const v = aN ? aA / <f64>aN : -1.0; aL = 0; aA = 0; aN = 0; return v; }
