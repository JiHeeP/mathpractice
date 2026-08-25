/* generator.js — 22레벨 문제 생성
 * 4지선다 문제는 { display, choices:[{html, key, correct, near}] } 형태로 만든다.
 *   - correct: 정답 보기 표시
 *   - near   : 값은 맞지만 형태가 틀린 보기(약분 안 함, 최소공배수 아님 등)에 붙는 안내문
 * 과정(step) 문제는 { op, A, B, sign } 형태 그대로 StepFrac 에 넘긴다.
 */
(() => {
const {
  F, gcd, lcm, randInt, pick, shuffle,
  reduce, isReduced, eqValue, eqExact, add, sub, addRaw, subRaw,
  toMixed, fromMixed, isImproper, isWhole,
  fracHTML, mixedHTML, fracText, mixedText
} = window.Frac;
const { D, addD, subD, normD, eqD, textD, fracToDec, decToFrac } = window.Dec;
const Pic = window.Pic;

/* ═══════════ 공통 헬퍼 ═══════════ */

/** 분모 d와 서로소인 분자 (1 ≤ n < d) */
function coprimeNumer(d) {
  const cands = [];
  for (let n = 1; n < d; n++) if (gcd(n, d) === 1) cands.push(n);
  return cands.length ? pick(cands) : 1;
}

/** 통분 연습에 좋은 분모 짝 (절반쯤은 서로소가 아니게) */
function pickTwoDenoms(maxLcm) {
  const cap = maxLcm || 60;
  for (let t = 0; t < 80; t++) {
    const b = randInt(2, 12), d = randInt(2, 12);
    if (b === d) continue;
    if (lcm(b, d) > cap) continue;
    if (Math.random() < 0.5 && gcd(b, d) === 1) continue;
    return [b, d];
  }
  return [4, 6];
}

const C = (html, key, correct, near) => ({ html, key: String(key), correct: !!correct, near: near || null });

/** 정답 1개 + 오답 후보들로 보기 4개를 완성 (key 중복 제거, 부족하면 filler 로 채움) */
function finalize(correctC, cands, filler) {
  const out = [correctC];
  const seen = new Set([correctC.key]);
  const push = c => { if (c && !seen.has(c.key)) { seen.add(c.key); out.push(c); } };
  cands.forEach(push);
  let guard = 0;
  while (out.length < 4 && guard++ < 100) push(filler());
  return shuffle(out.slice(0, 4));
}

const fracC  = (f, correct, near) => C(fracHTML(f), 'f' + fracText(f), correct, near);
const mixC   = (f, correct, near) => C(mixedHTML(f), 'm' + mixedText(f), correct, near);
const intC   = (n, correct) => C(`<span class="qc-num">${n}</span>`, 'i' + n, correct);
const decC   = (t, correct) => C(`<span class="qc-num">${t}</span>`, 'd' + t, correct);

const eqQ = inner => `${inner}<span class="q-op">=</span><span class="text-gray-300">?</span>`;

const NEAR_REDUCE = '값은 맞아요! 하지만 <b>기약분수</b>를 골라야 해요';
const NEAR_MIXED  = '값은 맞아요! 하지만 <b>대분수</b>로 나타낸 것을 골라야 해요';

/* ═══════════ L1 · L2 그림 개념 ═══════════ */

function genPicFrac() {
  if (Math.random() < 0.4) return genPicMixedFrac();   // 40%는 대분수 그림
  const kind = pick(['pie', 'bar', 'dots']);
  const d = kind === 'pie' ? randInt(2, 10) : kind === 'bar' ? randInt(2, 10) : pick([4, 6, 8, 9, 10, 12]);
  const n = randInt(1, d - 1);
  const svg = Pic[kind](n, d);
  const ans = F(n, d);                               // 그림 그대로 (약분하지 않은 표기가 정답)
  const cands = [F(d - n, d), F(n, n + d), F(Math.min(n + 1, d - 1) === n ? n - 1 : n + 1, d), F(n, d + 1), F(n, d - 1)]
    .filter(f => f.n >= 1 && f.d >= 2 && f.n < f.d && !eqValue(f, ans))
    .map(f => fracC(f, false));
  return {
    display: `<div class="pic-q">${svg}</div><div class="pic-cap">색칠한 부분을 분수로 나타내면?</div>`,
    choices: finalize(fracC(ans, true), cands,
      () => { const dd = randInt(2, 12), nn = randInt(1, dd - 1); const f = F(nn, dd); return eqValue(f, ans) ? null : fracC(f, false); })
  };
}

/** 대분수 그림 — 꽉 채운 도형 w개 + 일부만 색칠한 도형 1개 */
function genPicMixedFrac() {
  const kind = pick(['pie', 'bar']);
  const d = randInt(2, 8), n = randInt(1, d - 1);
  const w = randInt(1, kind === 'pie' ? 3 : 2);
  const full = Pic[kind](d, d), part = Pic[kind](n, d);
  const shapes = Array(w).fill(full).concat(part).join('');
  const wrap = kind === 'bar' ? 'pic-col' : 'pic-multi';
  const ans = fromMixed(w, n, d);                    // 그림 그대로의 대분수 (w와 n/d)
  const cands = [
    fracC(ans, false, NEAR_MIXED),                   // 가분수로 읽은 보기 (값은 같음)
    mixC(fromMixed(w + 1, n, d), false),
    w > 1 ? mixC(fromMixed(w - 1, n, d), false) : null,
    n + 1 < d ? mixC(fromMixed(w, n + 1, d), false) : null,
    n > 1 ? mixC(fromMixed(w, n - 1, d), false) : null,
    mixC(fromMixed(w, d - n, d), false)              // 색칠 안 된 쪽을 센 보기
  ].filter(Boolean).filter(c => !c.correct && c.key !== 'm' + mixedText(ans));
  return {
    display: `<div class="${wrap}">${shapes}</div><div class="pic-cap">색칠한 부분을 <b>대분수</b>로 나타내면?</div>`,
    choices: finalize(mixC(ans, true), cands,
      () => { const f = fromMixed(randInt(1, 4), randInt(1, d - 1), d); return eqValue(f, ans) ? null : mixC(f, false); })
  };
}

function genPicDec() {
  if (Math.random() < 0.4) return genPicMixedDec();    // 40%는 1을 넘는 소수 그림
  if (Math.random() < 0.5) {
    const k = randInt(1, 9);                          // 0.1 단위 막대
    const ans = textD(D(k, 1));
    const cands = [textD(D(k, 2)), textD(D(10 - k, 1)), textD(D(k === 9 ? 8 : k + 1, 1)), String(k)]
      .filter(t => t !== ans).map(t => decC(t, false));
    return {
      display: `<div class="pic-q">${Pic.tenthsBar(k)}</div><div class="pic-cap">색칠한 부분을 소수로 나타내면?</div>`,
      choices: finalize(decC(ans, true), cands, () => decC(textD(D(randInt(1, 9), 1)), false))
    };
  }
  const k = randInt(1, 99);                           // 10×10 격자 (0.01 단위)
  const ans = textD(D(k, 2));
  const cands = [textD(D(k, 1)), textD(D(100 - k, 2)), textD(D(k === 99 ? 98 : k + 1, 2)), textD(D(k, 3))]
    .filter(t => t !== ans).map(t => decC(t, false));
  return {
    display: `<div class="pic-q">${Pic.hundredthsGrid(k)}</div><div class="pic-cap">색칠한 부분을 소수로 나타내면?</div>`,
    choices: finalize(decC(ans, true), cands, () => decC(textD(D(randInt(1, 99), 2)), false))
  };
}

/** 1을 넘는 소수 그림 — 꽉 채운 그림 w개 + 일부만 색칠한 그림 1개 */
function genPicMixedDec() {
  if (Math.random() < 0.5) {
    const w = randInt(1, 2), k = randInt(1, 9);        // 0.1 막대: w.k
    const shapes = Array(w).fill(Pic.tenthsBar(10)).concat(Pic.tenthsBar(k)).join('');
    const ans = textD(D(w * 10 + k, 1));
    const cands = [
      textD(D(k, 1)),                                  // 정수부 빠뜨림
      textD(D(w * 10 + k, 2)),                         // 1.3 → 0.13
      textD(D((w + 1) * 10 + k, 1)), w > 1 ? textD(D((w - 1) * 10 + k, 1)) : null,
      textD(D(w * 10 + (k === 9 ? 8 : k + 1), 1))
    ].filter(t => t && t !== ans).map(t => decC(t, false));
    return {
      display: `<div class="pic-col">${shapes}</div><div class="pic-cap">색칠한 부분을 소수로 나타내면?</div>`,
      choices: finalize(decC(ans, true), cands, () => decC(textD(D(randInt(11, 39), 1)), false))
    };
  }
  const w = randInt(1, 2), k = randInt(1, 99);         // 10×10 격자: w.kk
  const shapes = Array(w).fill(Pic.hundredthsGrid(100)).concat(Pic.hundredthsGrid(k)).join('');
  const ans = textD(D(w * 100 + k, 2));
  const cands = [
    textD(D(k, 2)),                                    // 정수부 빠뜨림
    textD(D(w * 100 + k, 3)),                          // 소수점 위치 실수
    textD(D((w + 1) * 100 + k, 2)),
    textD(D(w * 100 + (k === 99 ? 98 : k + 1), 2)),
    k % 10 !== 0 ? textD(D(w * 10 + Math.round(k / 10), 1)) : null
  ].filter(t => t && t !== ans).map(t => decC(t, false));
  return {
    display: `<div class="pic-multi">${shapes}</div><div class="pic-cap">색칠한 부분을 소수로 나타내면?</div>`,
    choices: finalize(decC(ans, true), cands, () => decC(textD(D(randInt(101, 299), 2)), false))
  };
}

/* ═══════════ L3 · L4 가분수 ↔ 대분수 ═══════════ */

function mkConvertParts() {
  const d = randInt(2, 9), w = randInt(1, 8), r = coprimeNumer(d);
  return { d, w, r, improper: fromMixed(w, r, d) };
}

function genToMixed() {
  const { d, w, r, improper } = mkConvertParts();
  const cands = [
    fromMixed(r, Math.min(w, d - 1) || 1, d),                       // 몫·나머지 뒤바꿈
    fromMixed(w + 1, r, d), w > 1 ? fromMixed(w - 1, r, d) : null,
    r + 1 < d ? fromMixed(w, r + 1, d) : null, r > 1 ? fromMixed(w, r - 1, d) : null
  ].filter(Boolean).filter(f => !eqValue(f, improper)).map(f => mixC(f, false));
  return {
    display: eqQ(`${fracHTML(improper)}<span class="q-op">→</span><span class="q-hint">대분수</span>`),
    choices: finalize(mixC(improper, true), cands,
      () => mixC(fromMixed(randInt(1, 9), coprimeNumer(d), d), false))
  };
}

function genToImproper() {
  const { d, w, r, improper } = mkConvertParts();
  const cands = [F(w + r, d), F(w * d - r, d), F(w * r + d, d), F(w * d + r, d + 1), F(w * d + r - 1, d)]
    .filter(f => f.n >= 1 && !eqValue(f, improper)).map(f => fracC(f, false));
  return {
    display: eqQ(`${mixedHTML(improper)}<span class="q-op">→</span><span class="q-hint">가분수</span>`),
    choices: finalize(fracC(improper, true), cands,
      () => fracC(F(randInt(d + 1, 9 * d), d), false))
  };
}

/* ═══════════ L5 · L6 분수 ↔ 소수 ═══════════ */

/** 유한소수(세 자리 이내)가 되는 분모만 사용 */
const DEC_DENOMS = [2, 4, 5, 8, 10, 20, 25, 40, 50, 100, 125, 200, 250, 500];

function mkDecFrac() {
  const d = pick(DEC_DENOMS);
  const n = coprimeNumer(d);
  const w = Math.random() < 0.4 ? randInt(1, 5) : 0;  // 40%는 대분수
  const frac = w ? fromMixed(w, n, d) : F(n, d);
  return { frac, dec: fracToDec(frac, 3), w, n, d };
}

function genFracToDec() {
  const { frac, dec, w, n, d } = mkDecFrac();
  const ans = textD(dec);
  const shift = (dd, k) => textD(normD(D(dd.v, Math.min(3, Math.max(0, dd.p + k)))));
  const cands = [
    shift(dec, 1), shift(dec, -1),                     // 소수점 위치 실수
    `${w}.${n}${d}`.replace(/^0\./, '0.'),             // 3/4 → 0.34 같은 그대로 붙이기
    w ? `${w}.${n}` : `0.${n}`,
    textD(addD(dec, D(1, dec.p || 1)))
  ].filter(t => t !== ans && /^\d+(\.\d+)?$/.test(t)).map(t => decC(t, false));
  const shown = w ? mixedHTML(frac) : fracHTML(frac);
  return {
    display: eqQ(`${shown}<span class="q-op">→</span><span class="q-hint">소수</span>`),
    choices: finalize(decC(ans, true), cands,
      () => { const alt = mkDecFrac(); const t = textD(alt.dec); return t === ans ? null : decC(t, false); })
  };
}

function genDecToFrac() {
  const { frac, dec } = mkDecFrac();
  const answer = reduce(frac);
  const isMix = isImproper(answer);
  const correct = isMix ? mixC(answer, true) : fracC(answer, true);
  const raw = F(dec.v, Math.pow(10, dec.p));           // 75/100 — 약분 안 한 보기
  const cands = [];
  if (!eqExact(reduce(raw), raw)) cands.push(fracC(raw, false, NEAR_REDUCE));
  if (isMix) cands.push(fracC(answer, false, NEAR_MIXED));   // 가분수 그대로 쓴 보기
  const m = toMixed(answer);
  cands.push(isMix ? mixC(fromMixed(m.w, Math.min(m.n + 1, m.d - 1) === m.n ? Math.max(1, m.n - 1) : m.n + 1, m.d), false)
                   : fracC(F(answer.n, answer.d + 1), false));
  cands.push(fracC(F(dec.v % 100 || 1, 10), false));
  return {
    display: eqQ(`<span class="qc-num">${textD(dec)}</span><span class="q-op">→</span><span class="q-hint">분수</span>`),
    choices: finalize(correct, cands.filter(c => c && !c.correct),
      () => { const dd = randInt(2, 12); const f = F(coprimeNumer(dd), dd); return eqValue(f, answer) ? null : fracC(f, false); })
  };
}

/* ═══════════ 분수 계산 (step 문제 생성) ═══════════ */

function genSameAdd() {
  const d = randInt(3, 12);
  const a = randInt(1, d - 2), b = randInt(1, d - a - 1);
  return { op:'same-add', A:F(a, d), B:F(b, d), sign:'+' };
}
function genSameSub() {
  const d = randInt(3, 12);
  const a = randInt(2, d - 1), b = randInt(1, a - 1);
  return { op:'same-sub', A:F(a, d), B:F(b, d), sign:'−' };
}

/** 이분모 진분수 덧셈 — 합이 1을 넘고 정수는 아님 */
function genDiffAdd1() {
  for (let t = 0; t < 300; t++) {
    const [b, d] = pickTwoDenoms(36);
    const a = coprimeNumer(b), c = coprimeNumer(d);
    const r = addRaw(F(a, b), F(c, d));
    if (r.n <= r.d || r.n % r.d === 0) continue;      // 1 초과 + 비정수
    return { op:'diff-add1', A:F(a, b), B:F(c, d), sign:'+' };
  }
  return { op:'diff-add1', A:F(3, 4), B:F(5, 6), sign:'+' };
}

function genDiffSub() {
  for (let t = 0; t < 300; t++) {
    const [b, d] = pickTwoDenoms(36);
    const a = coprimeNumer(b), c = coprimeNumer(d);
    const r = subRaw(F(a, b), F(c, d));
    if (r.n <= 0) continue;
    return { op:'diff-sub', A:F(a, b), B:F(c, d), sign:'−' };
  }
  return { op:'diff-sub', A:F(3, 4), B:F(1, 6), sign:'−' };
}

function genMixedCalc(isAdd) {
  for (let t = 0; t < 300; t++) {
    const [b, d] = pickTwoDenoms(36);
    const A = fromMixed(randInt(1, 5), coprimeNumer(b), b);
    const B = fromMixed(randInt(1, 4), coprimeNumer(d), d);
    const r = isAdd ? add(A, B) : sub(A, B);
    if (r.n <= 0 || isWhole(r) || !isImproper(r)) continue;   // 답도 대분수가 되도록
    return { op: isAdd ? 'mixed-add' : 'mixed-sub', A, B, sign: isAdd ? '+' : '−', mixedInput:true };
  }
  return isAdd ? { op:'mixed-add', A:fromMixed(1,1,2), B:fromMixed(2,1,3), sign:'+', mixedInput:true }
               : { op:'mixed-sub', A:fromMixed(3,1,2), B:fromMixed(1,2,3), sign:'−', mixedInput:true };
}

/** 과정 문제의 정답 */
function fracAnswer(p) {
  switch (p.op) {
    case 'same-add': case 'diff-add1': case 'mixed-add': return add(p.A, p.B);
    case 'same-sub': case 'diff-sub':  case 'mixed-sub': return sub(p.A, p.B);
    default: return F(0, 1);
  }
}

/* ═══════════ 분수 계산 4지선다 ═══════════ */

/** 답이 진분수인 계산 (L7·L8·L14) */
function properCalcQuestion(p) {
  const ans = fracAnswer(p);
  const raw = p.sign === '+' ? addRaw(p.A, p.B) : subRaw(p.A, p.B);
  const cands = [];
  if (!eqExact(raw, ans)) cands.push(fracC(raw, false, NEAR_REDUCE));
  if (p.sign === '+') {
    const w = reduce(F(p.A.n + p.B.n, p.A.d + p.B.d));            // 분모끼리도 더함
    if (!eqValue(w, ans)) cands.push(fracC(w, false));
    const s = subRaw(p.A, p.B); if (s.n > 0 && !eqValue(reduce(s), ans)) cands.push(fracC(reduce(s), false));
  } else {
    const w = addRaw(p.A, p.B); if (!eqValue(reduce(w), ans) && reduce(w).n < reduce(w).d) cands.push(fracC(reduce(w), false));
    const nd = Math.abs(p.A.d - p.B.d) || p.A.d;
    const w2 = F(Math.abs(p.A.n - p.B.n) || 1, nd); if (w2.n < w2.d && !eqValue(w2, ans)) cands.push(fracC(reduce(w2), false));
  }
  if (ans.n + 1 < ans.d) cands.push(fracC(F(ans.n + 1, ans.d), false));
  cands.push(fracC(F(ans.n, ans.d + 1), false));
  return {
    display: eqQ(`${fracHTML(p.A)}<span class="q-op">${p.sign}</span>${fracHTML(p.B)}`),
    choices: finalize(fracC(ans, true), cands,
      () => { const dd = randInt(3, 14); const f = F(coprimeNumer(dd), dd); return eqValue(f, ans) ? null : fracC(f, false); })
  };
}

/** 답이 대분수인 계산 (L12·L16·L18) */
function mixedCalcQuestion(p) {
  const ans = fracAnswer(p);                          // 기약 가분수
  const raw = p.sign === '+' ? addRaw(p.A, p.B) : subRaw(p.A, p.B);
  const m = toMixed(ans);
  const shown = p.mixedInput ? mixedHTML : fracHTML;
  const cands = [fracC(ans, false, NEAR_MIXED)];      // 가분수 그대로 쓴 보기
  if (!eqExact(raw, ans)) cands.push(fracC(raw, false, NEAR_MIXED));
  cands.push(mixC(fromMixed(m.w + 1, m.n, m.d), false));
  if (m.w > 1) cands.push(mixC(fromMixed(m.w - 1, m.n, m.d), false));
  if (m.n + 1 < m.d && gcd(m.n + 1, m.d) === 1) cands.push(mixC(fromMixed(m.w, m.n + 1, m.d), false));
  if (m.n > 1 && gcd(m.n - 1, m.d) === 1) cands.push(mixC(fromMixed(m.w, m.n - 1, m.d), false));
  return {
    display: eqQ(`${shown(p.A)}<span class="q-op">${p.sign}</span>${shown(p.B)}`),
    choices: finalize(mixC(ans, true), cands,
      () => mixC(fromMixed(randInt(1, 6), coprimeNumer(m.d), m.d), false))
  };
}

/* ═══════════ L9 최소공배수 · L10 통분 ═══════════ */

function genLcm() {
  let a, b;
  do { a = randInt(2, 12); b = randInt(2, 12); } while (a === b || (Math.random() < 0.5 && gcd(a, b) === 1));
  const L = lcm(a, b);
  const cands = [a * b !== L ? a * b : null, gcd(a, b) !== L ? gcd(a, b) : null, a + b !== L ? a + b : null,
                 L * 2, L / 2 === Math.floor(L / 2) && L / 2 > 1 ? L / 2 : null]
    .filter(v => v && v !== L).map(v => intC(v, false));
  return {
    display: eqQ(`<span class="qc-num">${a}</span><span class="q-mid">${window.Frac.josa(a,'과','와')}</span><span class="qc-num">${b}</span><span class="q-mid">의 최소공배수</span>`),
    choices: finalize(intC(L, true), cands, () => { const v = L + pick([-2,-1,1,2,3]) * randInt(1,3); return v > 1 && v !== L ? intC(v, false) : null; })
  };
}

const pairC = (f1, f2, correct, near) =>
  C(`${fracHTML(f1)}<span class="pair-sep">${window.Frac.fracJosa(f1,'과','와')}</span>${fracHTML(f2)}`,
    'p' + fracText(f1) + '|' + fracText(f2), correct, near);

function genCommonDenom() {
  const [b, d] = pickTwoDenoms(48);
  const a = coprimeNumer(b), c = coprimeNumer(d);
  const L = lcm(b, d), x = a * (L / b), y = c * (L / d);
  const cands = [
    pairC(F(a, L), F(c, L), false),                                  // 분자를 안 바꿈
    pairC(F(y, L), F(x, L), false),                                  // 분자 뒤바뀜
    b * d !== L ? pairC(F(a * d, b * d), F(c * b, b * d), false,
      '통분은 맞아요! 하지만 <b>최소공배수</b>로 통분한 것을 골라야 해요') : null,
    pairC(F(x, L), F(c, L), false)                                   // 한쪽만 바꿈
  ].filter(Boolean);
  return {
    display: `<div class="pic-cap mb-2">두 분수를 <b>최소공배수</b>로 통분하면?</div>` +
             `${fracHTML(F(a, b))}<span class="pair-sep">${window.Frac.fracJosa(F(a,b),'과','와')}</span>${fracHTML(F(c, d))}`,
    choices: finalize(pairC(F(x, L), F(y, L), true), cands,
      () => pairC(F(x + randInt(1, 3), L), F(y, L), false))
  };
}

/* ═══════════ L19~L22 소수 계산 ═══════════ */

/** p자리 소수 (끝자리 0 아님) */
function randDec(p, maxWhole) {
  let v;
  do { v = randInt(1, (maxWhole || 9) * Math.pow(10, p) - 1); } while (v % 10 === 0);
  return D(v, p);
}

function decQuestion(isAdd, mixedPlaces) {
  let A, B, res;
  for (let t = 0; t < 200; t++) {
    if (mixedPlaces) {
      const pa = pick([1, 2]), pb = pa === 1 ? 2 : pick([1, 2]);
      if (pa === pb) continue;
      A = randDec(pa, 9); B = randDec(pb, 9);
    } else {
      const p = pick([1, 2]);
      A = randDec(p, 9); B = randDec(p, 9);
    }
    res = isAdd ? addD(A, B) : subD(A, B);
    if (res.v <= 0) continue;
    if (normD(res).p === 0) continue;                 // 답이 정수가 되면 다시
    break;
  }
  const ans = textD(res);
  const p = Math.max(A.p, B.p);
  const mis = isAdd ? A.v + B.v : Math.abs(A.v - B.v);              // 자리 안 맞추고 계산한 실수
  const cands = [
    textD(D(mis, p)), textD(D(mis, Math.min(3, p + 1))),
    textD(normD(D(res.v, Math.min(3, res.p + 1)))), textD(normD(D(res.v * 10, res.p))),
    textD(addD(res, D(1, p))), textD(subD(res, D(1, p)))
  ].filter(t => t !== ans && !/^-/.test(t)).map(t => decC(t, false));
  return {
    display: eqQ(`<span class="qc-num">${textD(A)}</span><span class="q-op">${isAdd ? '+' : '−'}</span><span class="qc-num">${textD(B)}</span>`),
    choices: finalize(decC(ans, true), cands,
      () => { const t = textD(addD(res, D(randInt(-20, 20) || 3, 2))); return t !== ans && !/^-/.test(t) ? decC(t, false) : null; })
  };
}

/* ═══════════ 레벨 → 생성기 매핑 ═══════════ */

const CHOICE_GENS = {
  'pic-frac':    genPicFrac,
  'pic-dec':     genPicDec,
  'to-mixed':    genToMixed,
  'to-improper': genToImproper,
  'frac-to-dec': genFracToDec,
  'dec-to-frac': genDecToFrac,
  'same-add':    () => properCalcQuestion(genSameAdd()),
  'same-sub':    () => properCalcQuestion(genSameSub()),
  'lcm':         genLcm,
  'common-denom':genCommonDenom,
  'diff-add1':   () => mixedCalcQuestion(genDiffAdd1()),
  'diff-sub':    () => properCalcQuestion(genDiffSub()),
  'mixed-add':   () => mixedCalcQuestion(genMixedCalc(true)),
  'mixed-sub':   () => mixedCalcQuestion(genMixedCalc(false)),
  'dec-add':     () => decQuestion(true,  false),
  'dec-sub':     () => decQuestion(false, false),
  'dec-add-mix': () => decQuestion(true,  true),
  'dec-sub-mix': () => decQuestion(false, true)
};

function generateChoiceSet(level, count) {
  const cfg = window.Levels.LEVEL_CONFIGS[level];
  const gen = CHOICE_GENS[cfg.type];
  const qs = [];
  for (let i = 0; i < count; i++) qs.push(gen());
  return qs;
}

function generateStepProblem(level) {
  const cfg = window.Levels.LEVEL_CONFIGS[level];
  switch (cfg.op) {
    case 'diff-add1': return genDiffAdd1();
    case 'diff-sub':  return genDiffSub();
    case 'mixed-add': return genMixedCalc(true);
    case 'mixed-sub': return genMixedCalc(false);
    default:          return genDiffSub();
  }
}

window.Gen = { generateStepProblem, generateChoiceSet, fracAnswer };
})();
