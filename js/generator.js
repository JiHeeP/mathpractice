/* generator.js — 레벨별 문제 생성 (세로셈/스텝용 + 4지선다용) */
(() => {
const {
  F, gcd, lcm, randInt, pick, shuffle,
  reduce, eqValue, eqExact, add, sub, mul, div, recip,
  addRaw, subRaw, mulRaw, divRaw,
  toMixed, fromMixed, isImproper, isWhole,
  fracHTML, mixedHTML, fracText, mixedText
} = window.Frac;

/* ═══════════ 정수 문제 (L1·L2 세로셈) ═══════════ */

/** 두자리수 × 한자리수 — 일의 자리에서 반드시 올림이 생기도록 */
function genIntMult2x1() {
  let a, b, aOnes;
  do { a = randInt(11, 99); b = randInt(2, 9); aOnes = a % 10; } while (aOnes * b < 10);
  const aTens = Math.floor(a / 10);
  const onesProd = aOnes * b;
  const carry = Math.floor(onesProd / 10);
  return {
    kind: 'int-mult', a, b, aOnes, aTens,
    onesProd, carry, onesDigit: onesProd % 10,
    tensProd: aTens * b, tensWithCarry: aTens * b + carry,
    ans: a * b,
    text: `${a} × ${b}`
  };
}

/** 두자리수 ÷ 한자리수 */
function genIntDiv2d1() {
  const dv = randInt(2, 9);
  const dd = randInt(Math.max(10, dv), 99);
  return { kind: 'int-div', dd, dv, q: Math.floor(dd / dv), r: dd % dv,
           ddStr: String(dd), dvStr: String(dv), text: `${dd} ÷ ${dv}` };
}

/* ═══════════ 분수 문제 ═══════════ */

/** 분모 d와 서로소인 분자 하나 고르기 (1 ≤ n < d) — 피연산자를 기약분수로 유지 */
function coprimeNumer(d, maxN) {
  const top = Math.min(maxN === undefined ? d - 1 : maxN, d - 1);
  const cands = [];
  for (let n = 1; n <= top; n++) if (gcd(n, d) === 1) cands.push(n);
  return cands.length ? pick(cands) : 1;
}

/** 분모가 같은 덧셈 — 결과가 1을 넘지 않도록(가분수 회피) */
function genSameAdd() {
  const d = randInt(3, 12);
  const a = randInt(1, d - 2);
  const b = randInt(1, d - a - 1);
  return { op:'same-add', A:F(a,d), B:F(b,d), sign:'+' };
}

/** 분모가 같은 뺄셈 — 결과가 양수 */
function genSameSub() {
  const d = randInt(3, 12);
  const a = randInt(2, d - 1);
  const b = randInt(1, a - 1 < 1 ? 1 : a - 1);
  return { op:'same-sub', A:F(a,d), B:F(b,d), sign:'−' };
}

/** 통분이 필요한 분모 두 개 고르기 (절반 정도는 서로소가 아니게) */
function pickTwoDenoms(maxLcm) {
  const cap = maxLcm || 60;
  for (let t = 0; t < 80; t++) {
    const b = randInt(2, 12), d = randInt(2, 12);
    if (b === d) continue;
    if (lcm(b, d) > cap) continue;                // 통분 결과가 너무 커지지 않게
    if (Math.random() < 0.5 && gcd(b, d) === 1) continue;  // 최소공배수 학습을 위해 서로소가 아닌 짝도 섞기
    return [b, d];
  }
  return [4, 6];
}

/** 분모가 다른 덧셈 — 결과가 1을 넘지 않도록 */
function genDiffAdd() {
  for (let t = 0; t < 200; t++) {
    const [b, d] = pickTwoDenoms();
    const a = coprimeNumer(b), c = coprimeNumer(d);
    const r = addRaw(F(a,b), F(c,d));
    if (r.n >= r.d) continue;
    return { op:'diff-add', A:F(a,b), B:F(c,d), sign:'+' };
  }
  return { op:'diff-add', A:F(1,4), B:F(1,6), sign:'+' };
}

/** 분모가 다른 뺄셈 — 결과가 양수 */
function genDiffSub() {
  for (let t = 0; t < 200; t++) {
    const [b, d] = pickTwoDenoms();
    const a = coprimeNumer(b), c = coprimeNumer(d);
    const r = subRaw(F(a,b), F(c,d));
    if (r.n <= 0) continue;
    return { op:'diff-sub', A:F(a,b), B:F(c,d), sign:'−' };
  }
  return { op:'diff-sub', A:F(3,4), B:F(1,6), sign:'−' };
}

/** 진분수 × 진분수 */
function genFracMul() {
  const b = randInt(2, 10), a = coprimeNumer(b);
  const d = randInt(2, 10), c = coprimeNumer(d);
  return { op:'mul', A:F(a,b), B:F(c,d), sign:'×' };
}

/** 진분수 ÷ 진분수 */
function genFracDiv() {
  for (let t = 0; t < 100; t++) {
    const b = randInt(2, 10), a = coprimeNumer(b);
    const d = randInt(2, 10), c = coprimeNumer(d);
    if (isWhole(div(F(a,b), F(c,d)))) continue;   // 답이 정수가 되면 다시 (분수 답으로 통일)
    return { op:'div', A:F(a,b), B:F(c,d), sign:'÷' };
  }
  return { op:'div', A:F(1,2), B:F(3,5), sign:'÷' };
}

/** 가분수 ↔ 대분수 변환 */
function genConvert() {
  const d = randInt(2, 9);
  const w = randInt(1, 8);
  const r = coprimeNumer(d);
  const improper = fromMixed(w, r, d);
  const dir = Math.random() < 0.5 ? 'toMixed' : 'toImproper';
  return { op:'convert', dir, improper, w, r, d };
}

/** 대분수 덧셈·뺄셈 */
function genMixedAddSub() {
  for (let t = 0; t < 200; t++) {
    const [b, d] = pickTwoDenoms(36);   // 대분수는 통분 결과가 더 작게
    const A = fromMixed(randInt(1, 5), coprimeNumer(b), b);
    const B = fromMixed(randInt(1, 4), coprimeNumer(d), d);
    const isAdd = Math.random() < 0.5;
    const r = isAdd ? add(A, B) : sub(A, B);
    if (!isAdd && r.n <= 0) continue;
    if (!isAdd && !isImproper(r)) continue;         // 뺄셈 결과도 대분수가 되도록
    return { op: isAdd ? 'mixed-add' : 'mixed-sub', A, B, sign: isAdd ? '+' : '−', mixedInput:true };
  }
  return { op:'mixed-add', A:fromMixed(1,1,2), B:fromMixed(2,1,3), sign:'+', mixedInput:true };
}

/** 대분수 곱셈·나눗셈 */
function genMixedMulDiv() {
  for (let t = 0; t < 200; t++) {
    const b = randInt(2, 8), d = randInt(2, 8);
    const A = fromMixed(randInt(1, 4), coprimeNumer(b), b);
    const B = Math.random() < 0.35
      ? F(coprimeNumer(d), d)                       // 상대는 진분수인 경우도
      : fromMixed(randInt(1, 3), coprimeNumer(d), d);
    const isMul = Math.random() < 0.5;
    const r = isMul ? mul(A, B) : div(A, B);
    if (r.n <= 0 || r.d > 48 || r.n > 300) continue;  // 답의 분모가 너무 커지지 않게
    if (!isImproper(r) || isWhole(r)) continue;       // 답이 반드시 대분수가 되도록
    return { op: isMul ? 'mixed-mul' : 'mixed-div', A, B, sign: isMul ? '×' : '÷', mixedInput:true };
  }
  return { op:'mixed-mul', A:fromMixed(1,1,2), B:F(2,3), sign:'×', mixedInput:true };
}

/** 분수 문제의 정답 계산 */
function fracAnswer(p) {
  switch (p.op) {
    case 'same-add': case 'diff-add': case 'mixed-add': return add(p.A, p.B);
    case 'same-sub': case 'diff-sub': case 'mixed-sub': return sub(p.A, p.B);
    case 'mul': case 'mixed-mul': return mul(p.A, p.B);
    case 'div': case 'mixed-div': return div(p.A, p.B);
    case 'convert': return p.improper;
    default: return F(0, 1);
  }
}

/* ═══════════ 4지선다 보기 만들기 ═══════════ */

/** 값이 중복되지 않게 4개까지 채운다. 후보는 '흔한 실수'부터 우선 사용 */
function makeFracChoices(correct, candidates) {
  const out = [correct];
  const seen = new Set([fracText(correct)]);
  const push = (f) => {
    if (!f || !isFinite(f.n) || !isFinite(f.d) || f.d === 0) return;
    if (f.n <= 0 || f.d <= 0) return;
    if (Math.abs(f.n) > 999 || f.d > 999) return;
    const k = fracText(f);
    if (seen.has(k)) return;
    seen.add(k); out.push(f);
  };
  candidates.forEach(push);
  let guard = 0;
  while (out.length < 4 && guard++ < 80) {          // 모자라면 정답 근처 값으로 채움
    const dn = randInt(-3, 3), dd = randInt(-2, 2);
    const n = correct.n + dn, d = correct.d + dd;
    if (n > 0 && d > 1) push(reduce(F(n, d)));
  }
  while (out.length < 4) push(F(randInt(1, 9), randInt(2, 12)));
  return shuffle(out.slice(0, 4));
}

/** 정수 보기 */
function makeIntChoices(correct, min, max) {
  const set = new Set([correct]);
  let att = 0;
  while (set.size < 4 && att++ < 60) {
    const off = randInt(1, Math.max(3, Math.floor(Math.abs(correct) * 0.1) || 3));
    const w = Math.random() > 0.5 ? correct + off : correct - off;
    if (w >= min && w <= max && w !== correct) set.add(w);
  }
  while (set.size < 4) { const v = randInt(min, max); if (v !== correct) set.add(v); }
  return shuffle([...set]);
}

/** 분수 문제에 대한 '흔한 오답' 후보들 */
function wrongCandidates(p, correct) {
  const A = p.A, B = p.B, out = [];
  const raw = (() => {
    switch (p.op) {
      case 'same-add': case 'diff-add': case 'mixed-add': return addRaw(A, B);
      case 'same-sub': case 'diff-sub': case 'mixed-sub': return subRaw(A, B);
      case 'mul': case 'mixed-mul': return mulRaw(A, B);
      case 'div': case 'mixed-div': return divRaw(A, B);
      default: return correct;
    }
  })();
  if (!eqExact(raw, correct)) out.push(raw);                   // ① 약분하지 않은 답

  if (/add/.test(p.op)) {
    out.push(reduce(F(A.n + B.n, A.d + B.d)));                 // ② 분모끼리도 더해버림
    out.push(reduce(subRaw(A, B)));                            // ③ 연산 착각
  } else if (/sub/.test(p.op)) {
    out.push(reduce(F(Math.abs(A.n - B.n), Math.abs(A.d - B.d) || A.d)));
    out.push(reduce(addRaw(A, B)));
  } else if (/mul/.test(p.op)) {
    out.push(reduce(addRaw(A, B)));                            // ② 통분해서 더해버림
    out.push(reduce(divRaw(A, B)));
  } else if (/div/.test(p.op)) {
    out.push(reduce(mulRaw(A, B)));                            // ② 뒤집지 않고 그냥 곱함
    out.push(reduce(divRaw(recip(A), recip(B))));              // ③ 앞 분수를 뒤집음
  }
  out.push(reduce(F(correct.n + 1, correct.d)));
  out.push(reduce(F(correct.n, correct.d + 1)));
  return out;
}

/* ═══════════ 4지선다 세트 생성 ═══════════ */

function fracChoiceQuestion(p) {
  const correct = fracAnswer(p);
  const choices = makeFracChoices(correct, wrongCandidates(p, correct));
  return {
    kind: 'frac',
    op: p.op,
    display: `${fracHTML(p.A)}<span class="q-op">${p.sign}</span>${fracHTML(p.B)}`,
    text: `${fracText(p.A)} ${p.sign} ${fracText(p.B)}`,
    answer: correct,
    choices
  };
}

function intChoiceQuestion() {
  if (Math.random() < 0.5) {
    const a = randInt(11, 99), b = randInt(2, 9), ans = a * b;
    return { kind:'int', display:`${a} <span class="q-op">×</span> ${b}`, text:`${a} × ${b}`,
             answer: ans, choices: makeIntChoices(ans, 20, 900) };
  }
  const b = randInt(2, 9), q = randInt(10, Math.floor(99 / b)), dd = q * b;
  return { kind:'int', display:`${dd} <span class="q-op">÷</span> ${b}`, text:`${dd} ÷ ${b}`,
           answer: q, choices: makeIntChoices(q, 5, 60) };
}

const CHOICE_POOLS = {
  'int-mixed':  null,                                     // 정수 전용
  'same-mixed': [genSameAdd, genSameSub],
  'diff-mixed': [genDiffAdd, genDiffSub],
  'muldiv':     [genFracMul, genFracDiv]
};

/** 4지선다 레벨의 문제 배열 생성 */
function generateChoiceSet(level, count) {
  const cfg = window.Levels.LEVEL_CONFIGS[level];
  const pool = CHOICE_POOLS[cfg.type];
  const qs = [];
  for (let i = 0; i < count; i++) {
    qs.push(pool ? fracChoiceQuestion(pick(pool)()) : intChoiceQuestion());
  }
  return qs;
}

/** 스텝(세로셈) 레벨의 문제 1개 생성 */
function generateStepProblem(level) {
  const cfg = window.Levels.LEVEL_CONFIGS[level];
  if (cfg.engine === 'int-mult') return genIntMult2x1();
  if (cfg.engine === 'int-div')  return genIntDiv2d1();
  switch (cfg.op) {
    case 'same-add':     return genSameAdd();
    case 'same-sub':     return genSameSub();
    case 'diff-add':     return genDiffAdd();
    case 'diff-sub':     return genDiffSub();
    case 'mul':          return genFracMul();
    case 'div':          return genFracDiv();
    case 'convert':      return genConvert();
    case 'mixed-addsub': return genMixedAddSub();
    case 'mixed-muldiv': return genMixedMulDiv();
    default:             return genSameAdd();
  }
}

window.Gen = {
  genIntMult2x1, genIntDiv2d1,
  generateStepProblem, generateChoiceSet,
  fracAnswer, makeFracChoices, makeIntChoices
};
})();
