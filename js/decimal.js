/* decimal.js — 소수 연산 코어
 * 부동소수점 오차(0.1+0.2=0.30000…)를 피하려고 소수를
 * { v: 정수값, p: 소수점 아래 자릿수 } 로 다룬다. 예: 3.25 → {v:325, p:2}
 */
(() => {
const { F, reduce, gcd } = window.Frac;

const POW = [1, 10, 100, 1000];

function D(v, p) { return { v, p }; }

/** 두 소수의 자릿수를 맞춘다 */
function align(a, b) {
  const p = Math.max(a.p, b.p);
  return [D(a.v * POW[p - a.p], p), D(b.v * POW[p - b.p], p), p];
}

function addD(a, b) { const [x, y, p] = align(a, b); return D(x.v + y.v, p); }
function subD(a, b) { const [x, y, p] = align(a, b); return D(x.v - y.v, p); }

/** 끝자리 0을 정리한 표준형 (2.50 → 2.5) */
function normD(d) {
  let { v, p } = d;
  while (p > 0 && v % 10 === 0) { v /= 10; p--; }
  return D(v, p);
}

function eqD(a, b) { const [x, y] = align(a, b); return x.v === y.v; }

/** "3.25" 같은 문자열 표기 */
function textD(d) {
  const n = normD(d);
  if (n.p === 0) return String(n.v);
  const neg = n.v < 0, s = String(Math.abs(n.v)).padStart(n.p + 1, '0');
  return (neg ? '-' : '') + s.slice(0, -n.p) + '.' + s.slice(-n.p);
}

/** 정수부/소수부 분리 (그림·오답 생성용) */
function partsD(d) {
  const n = normD(d);
  return { whole: Math.trunc(n.v / POW[n.p]), fracDigits: n.p ? String(Math.abs(n.v) % POW[n.p]).padStart(n.p, '0') : '' };
}

/** 유한소수로 나타낼 수 있는 분수인지 (소수점 아래 maxP자리 이내) */
function fracToDec(f, maxP) {
  const r = reduce(f);
  let d = r.d, twos = 0, fives = 0;
  while (d % 2 === 0) { d /= 2; twos++; }
  while (d % 5 === 0) { d /= 5; fives++; }
  if (d !== 1) return null;                        // 무한소수
  const p = Math.max(twos, fives);
  if (p > (maxP ?? 3)) return null;
  return D(r.n * (POW[p] / r.d), p);
}

/** 소수 → 기약분수 */
function decToFrac(d) { const n = normD(d); return reduce(F(n.v, POW[n.p])); }

window.Dec = { D, align, addD, subD, normD, eqD, textD, partsD, fracToDec, decToFrac };
})();
