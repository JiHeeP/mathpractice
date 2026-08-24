/* fraction.js — 분수 연산 코어 유틸
 * 모든 분수는 { n: 분자, d: 분모 } 형태의 "가분수(improper)" 로 다룬다.
 * 음수는 분자(n)에만 담고 분모(d)는 항상 양수로 정규화한다.
 */

/* ── 기본 정수 유틸 ── */
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1;
}
function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ── 분수 생성/정규화 ── */
function F(n, d) {
  if (d === 0) throw new Error('분모는 0이 될 수 없습니다.');
  if (d < 0) { n = -n; d = -d; }
  return { n, d };
}
/** 기약분수로 줄이기 */
function reduce(f) { const g = gcd(f.n, f.d); return F(f.n / g, f.d / g); }
/** 이미 기약분수인가 */
function isReduced(f) { return gcd(f.n, f.d) === 1; }
/** 두 분수가 같은 값인가 */
function eqValue(a, b) { return a.n * b.d === b.n * a.d; }
/** 완전히 같은 표기인가 (약분 상태까지 일치) */
function eqExact(a, b) { return a.n === b.n && a.d === b.d; }

/* ── 사칙연산 (약분하지 않은 raw 결과) ── */
function addRaw(a, b) { const L = lcm(a.d, b.d); return F(a.n * (L / a.d) + b.n * (L / b.d), L); }
function subRaw(a, b) { const L = lcm(a.d, b.d); return F(a.n * (L / a.d) - b.n * (L / b.d), L); }
function mulRaw(a, b) { return F(a.n * b.n, a.d * b.d); }
function divRaw(a, b) { if (b.n === 0) throw new Error('0으로 나눌 수 없습니다.'); return F(a.n * b.d, a.d * b.n); }

const add = (a, b) => reduce(addRaw(a, b));
const sub = (a, b) => reduce(subRaw(a, b));
const mul = (a, b) => reduce(mulRaw(a, b));
const div = (a, b) => reduce(divRaw(a, b));
/** 역수 */
function recip(f) { return F(f.d, f.n); }

/* ── 대분수 변환 ── */
/** 가분수 → { w: 정수부, n: 분자, d: 분모 } (정수부 부호에 값을 몰아줌) */
function toMixed(f) {
  const sign = f.n < 0 ? -1 : 1;
  const an = Math.abs(f.n);
  const w = Math.floor(an / f.d), r = an % f.d;
  return { w: sign * w, n: r, d: f.d, sign };
}
/** 대분수 → 가분수 */
function fromMixed(w, n, d) {
  const sign = w < 0 ? -1 : 1;
  return F(sign * (Math.abs(w) * d + n), d);
}
/** 가분수인가 (|n| >= d, 단 분모 1 제외) */
function isImproper(f) { return Math.abs(f.n) >= f.d && f.d !== 1; }
/** 정수로 딱 떨어지는가 */
function isWhole(f) { return f.n % f.d === 0; }

/* ── 표기 ── */
/** 분수 HTML (분자/분모 세로 표기) */
function fracHTML(f, cls) {
  const c = cls ? ' ' + cls : '';
  if (f.d === 1) return `<span class="fr-int${c}">${f.n}</span>`;
  const neg = f.n < 0;
  const body = `<span class="fr${c}"><span class="fr-n">${Math.abs(f.n)}</span><span class="fr-d">${f.d}</span></span>`;
  return neg ? `<span class="fr-neg">−</span>${body}` : body;
}
/** 대분수 HTML */
function mixedHTML(f, cls) {
  if (f.d === 1 || isWhole(f)) return `<span class="fr-int">${f.n / f.d}</span>`;
  if (!isImproper(f)) return fracHTML(f, cls);
  const m = toMixed(f);
  const sign = m.w < 0 ? '<span class="fr-neg">−</span>' : '';
  return `${sign}<span class="fr-w">${Math.abs(m.w)}</span>${fracHTML(F(m.n, m.d), cls)}`;
}
/** 텍스트 표기 (로그/보기 문자열용) */
function fracText(f) { return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`; }
function mixedText(f) {
  if (isWhole(f)) return String(f.n / f.d);
  if (!isImproper(f)) return fracText(f);
  const m = toMixed(f);
  return `${m.w} ${m.n}/${m.d}`;
}

/* ── 파싱 (학생 입력 "3/4", "1 2/3", "5") ── */
function parseFrac(str) {
  const s = String(str || '').trim().replace(/\s+/g, ' ');
  if (!s) return null;
  let m;
  if ((m = s.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/))) {          // 대분수 "1 2/3"
    const d = +m[3]; if (!d) return null;
    return fromMixed(+m[1], +m[2], d);
  }
  if ((m = s.match(/^(-?\d+)\s*\/\s*(\d+)$/))) {                   // 분수 "3/4"
    const d = +m[2]; if (!d) return null;
    return F(+m[1], d);
  }
  if ((m = s.match(/^(-?\d+)$/))) return F(+m[1], 1);               // 정수
  return null;
}

window.Frac = {
  gcd, lcm, randInt, pick, shuffle,
  F, reduce, isReduced, eqValue, eqExact,
  addRaw, subRaw, mulRaw, divRaw, add, sub, mul, div, recip,
  toMixed, fromMixed, isImproper, isWhole,
  fracHTML, mixedHTML, fracText, mixedText, parseFrac
};
