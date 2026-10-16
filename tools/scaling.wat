;; The scaling-law figure's training loop (site/assets/js/figures.js, F.scaling2), in WebAssembly.
;; One run: `steps` samples of online SGD on a linear model of N = n − 1 weights, each sample drawn as z = L g with L the
;; lower-triangular Cholesky factor (n × n, row-major) of the features' and target's joint covariance and g standard
;; normal; z[0..N) are the features, z[N] the target. The weights v are updated in place: v += lr (y − v·z) z.
;; Random numbers: mulberry32 (as the JavaScript fallback), normals by Marsaglia's polar method (one log a pair,
;; imported). Factor, samples and weights in single precision, so the triangular product runs four lanes at a time
;; (f32x4); the sums of four lanes are added in double.
;; Build: npx -p wabt@1.0.36 wat2wasm tools/scaling.wat -o - | base64  → SCALING_WASM in figures.js
(module
  (import "m" "log" (func $log (param f64) (result f64)))
  (memory (export "mem") 4)
  (global $s (mut i32) (i32.const 1))
  (global $spare (mut f64) (f64.const 0))
  (global $has (mut i32) (i32.const 0))

  (func (export "seed") (param $x i32)
    (global.set $s (local.get $x)) (global.set $has (i32.const 0)))

  ;; mulberry32: a uniform in [0, 1)
  (func $rnd (result f64) (local $t i32)
    (global.set $s (i32.add (global.get $s) (i32.const 0x6D2B79F5)))
    (local.set $t (global.get $s))
    (local.set $t (i32.mul (i32.xor (local.get $t) (i32.shr_u (local.get $t) (i32.const 15))) (i32.or (local.get $t) (i32.const 1))))
    (local.set $t (i32.xor (local.get $t)
      (i32.add (local.get $t) (i32.mul (i32.xor (local.get $t) (i32.shr_u (local.get $t) (i32.const 7))) (i32.or (local.get $t) (i32.const 61))))))
    (f64.div (f64.convert_i32_u (i32.xor (local.get $t) (i32.shr_u (local.get $t) (i32.const 14)))) (f64.const 4294967296)))

  ;; a standard normal (Marsaglia's polar method, the pair's second kept for the next call)
  (func $randn (result f64) (local $u f64) (local $v f64) (local $q f64) (local $m f64)
    (if (global.get $has) (then (global.set $has (i32.const 0)) (return (global.get $spare))))
    (loop $again
      (local.set $u (f64.sub (f64.mul (call $rnd) (f64.const 2)) (f64.const 1)))
      (local.set $v (f64.sub (f64.mul (call $rnd) (f64.const 2)) (f64.const 1)))
      (local.set $q (f64.add (f64.mul (local.get $u) (local.get $u)) (f64.mul (local.get $v) (local.get $v))))
      (br_if $again (i32.or (f64.ge (local.get $q) (f64.const 1)) (f64.eq (local.get $q) (f64.const 0)))))
    (local.set $m (f64.sqrt (f64.div (f64.mul (f64.const -2) (call $log (local.get $q))) (local.get $q))))
    (global.set $spare (f64.mul (local.get $v) (local.get $m))) (global.set $has (i32.const 1))
    (f64.mul (local.get $u) (local.get $m)))

  ;; byte pointers: L (n·n f32), v (n − 1 f32), z and g (n f32 each)
  (func (export "train") (param $L i32) (param $n i32) (param $v i32) (param $z i32) (param $g i32) (param $lr f64) (param $steps i32)
    (local $i i32) (local $a i32) (local $b i32) (local $row i32) (local $N i32) (local $acc v128) (local $q f64) (local $e f64)
    (local.set $N (i32.sub (local.get $n) (i32.const 1)))
    (block $done (loop $sample
      (br_if $done (i32.ge_u (local.get $i) (local.get $steps)))
      ;; g ~ N(0, I)
      (local.set $a (i32.const 0))
      (block $gd (loop $gl
        (br_if $gd (i32.ge_u (local.get $a) (local.get $n)))
        (f32.store (i32.add (local.get $g) (i32.shl (local.get $a) (i32.const 2))) (f32.demote_f64 (call $randn)))
        (local.set $a (i32.add (local.get $a) (i32.const 1))) (br $gl)))
      ;; z = L g, row a summing b = 0 … a, two at a time
      (local.set $a (i32.const 0))
      (block $zd (loop $zl
        (br_if $zd (i32.ge_u (local.get $a) (local.get $n)))
        (local.set $row (i32.add (local.get $L) (i32.shl (i32.mul (local.get $a) (local.get $n)) (i32.const 2))))
        (local.set $acc (v128.const f32x4 0 0 0 0)) (local.set $b (i32.const 0))
        (block $pd (loop $pl
          (br_if $pd (i32.gt_s (i32.add (local.get $b) (i32.const 3)) (local.get $a)))
          (local.set $acc (f32x4.add (local.get $acc) (f32x4.mul
            (v128.load (i32.add (local.get $row) (i32.shl (local.get $b) (i32.const 2))))
            (v128.load (i32.add (local.get $g) (i32.shl (local.get $b) (i32.const 2)))))))
          (local.set $b (i32.add (local.get $b) (i32.const 4))) (br $pl)))
        (local.set $q (f64.add
          (f64.add (f64.promote_f32 (f32x4.extract_lane 0 (local.get $acc))) (f64.promote_f32 (f32x4.extract_lane 1 (local.get $acc))))
          (f64.add (f64.promote_f32 (f32x4.extract_lane 2 (local.get $acc))) (f64.promote_f32 (f32x4.extract_lane 3 (local.get $acc))))))
        (block $td (loop $tl
          (br_if $td (i32.gt_s (local.get $b) (local.get $a)))
          (local.set $q (f64.add (local.get $q) (f64.promote_f32 (f32.mul
            (f32.load (i32.add (local.get $row) (i32.shl (local.get $b) (i32.const 2))))
            (f32.load (i32.add (local.get $g) (i32.shl (local.get $b) (i32.const 2))))))))
          (local.set $b (i32.add (local.get $b) (i32.const 1))) (br $tl)))
        (f32.store (i32.add (local.get $z) (i32.shl (local.get $a) (i32.const 2))) (f32.demote_f64 (local.get $q)))
        (local.set $a (i32.add (local.get $a) (i32.const 1))) (br $zl)))
      ;; e = lr (y − v·z); v += e z
      (local.set $q (f64.const 0)) (local.set $a (i32.const 0))
      (block $dd (loop $dl
        (br_if $dd (i32.ge_u (local.get $a) (local.get $N)))
        (local.set $q (f64.add (local.get $q) (f64.promote_f32 (f32.mul
          (f32.load (i32.add (local.get $v) (i32.shl (local.get $a) (i32.const 2))))
          (f32.load (i32.add (local.get $z) (i32.shl (local.get $a) (i32.const 2))))))))
        (local.set $a (i32.add (local.get $a) (i32.const 1))) (br $dl)))
      (local.set $e (f64.mul (local.get $lr) (f64.sub (f64.promote_f32 (f32.load (i32.add (local.get $z) (i32.shl (local.get $N) (i32.const 2))))) (local.get $q))))
      (local.set $a (i32.const 0))
      (block $ud (loop $ul
        (br_if $ud (i32.ge_u (local.get $a) (local.get $N)))
        (f32.store (i32.add (local.get $v) (i32.shl (local.get $a) (i32.const 2)))
          (f32.add (f32.load (i32.add (local.get $v) (i32.shl (local.get $a) (i32.const 2))))
            (f32.mul (f32.demote_f64 (local.get $e)) (f32.load (i32.add (local.get $z) (i32.shl (local.get $a) (i32.const 2)))))))
        (local.set $a (i32.add (local.get $a) (i32.const 1))) (br $ul)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $sample))))
)
