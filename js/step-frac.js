/* step-frac.js — 분수 세로/단계 풀이 엔진
 * 통분 → 계산 → 약분 → (대분수) 흐름을 한 단계씩 물어보고,
 * 답할 때마다 위쪽 '풀이판'이 한 줄씩 채워진다.
 */
const StepFrac = (() => {
const FR = window.Frac;
const {
  F, gcd, lcm, reduce, isReduced, eqExact, eqValue, recip,
  addRaw, subRaw, mulRaw, divRaw, toMixed, fromMixed, isImproper,
  fracHTML, mixedHTML, fracText, mixedText, parseFrac,
  josa, fracJosa, mixedJosa
} = FR;

const PAL = [
  { bg:'#eef2ff', bd:'#c7d2fe', badge:'#e0e7ff', tx:'#4338ca' },
  { bg:'#fff7ed', bd:'#fed7aa', badge:'#ffedd5', tx:'#c2410c' },
  { bg:'#ecfdf5', bd:'#a7f3d0', badge:'#d1fae5', tx:'#047857' },
  { bg:'#f5f3ff', bd:'#ddd6fe', badge:'#ede9fe', tx:'#6d28d9' },
  { bg:'#fdf2f8', bd:'#fbcfe8', badge:'#fce7f3', tx:'#be185d' },
  { bg:'#eff6ff', bd:'#bfdbfe', badge:'#dbeafe', tx:'#1d4ed8' }
];
const ROW_LABELS = {
  orig:'문제', improper:'가분수로', flip:'곱셈으로', common:'통분',
  calc:'계산', reduce:'약분', answer:'답'
};

let level, cfg, prob, steps, idx, probOK, waiting, rows;
let stepStart, stepTick, stepLog, probStart, sessionLog;

/** 아직 값이 정해지지 않은 자리를 포함한 분수 표기 */
const slot = (n, d) => `<span class="fr"><span class="fr-n">${n}</span><span class="fr-d">${d}</span></span>`;

/* ═══ 시작 ═══ */
function init(lv, mode, config, onExit) {
  level = lv; cfg = config;
  sessionLog = [];
  Session.start(lv, mode, config, 'frac', onExit);
  next();
}

function next() {
  prob = Gen.generateStepProblem(level);
  idx = 0; probOK = true; waiting = false;
  stepLog = []; probStart = Date.now();
  buildSteps();
  render();
  Session.startTimer();
  showStep();
}

/* ═══ 단계별 시간 ═══ */
/** 밀리초 → '3.4초' / '1분 5.2초' */
function secText(ms) {
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}초` : `${Math.floor(s / 60)}분 ${(s % 60).toFixed(1)}초`;
}

/** 지금 단계의 간단한 시계 — 0.1초마다 칩 하나만 고쳐 쓴다 */
function startStepClock() {
  stopStepClock();
  stepStart = Date.now();
  const paint = () => {
    const el = document.getElementById('stepClock');
    if (!el) return stopStepClock();          // 화면이 바뀌면 스스로 멈춘다
    el.textContent = `⏱ ${secText(Date.now() - stepStart)}`;
  };
  paint();
  stepTick = setInterval(paint, 100);
}
function stopStepClock() { if (stepTick) { clearInterval(stepTick); stepTick = null; } }

/** 방금 푼 문제의 단계별 수행 시간 표 */
function timeBoardHTML() {
  if (!stepLog.length) return '';
  const total = Date.now() - probStart;
  const worst = stepLog.reduce((a, b) => (b.ms > a.ms ? b : a)).ms;
  return `<div class="tt">
    <div class="tt-head">⏱ 단계별 수행 시간</div>
    ${stepLog.map(r => `<div class="tt-row${r.ms === worst && stepLog.length > 1 ? ' tt-slow' : ''}">
      <span class="tt-no">STEP ${r.no}</span>
      <span class="tt-desc">${r.ok ? '' : '❌ '}${r.desc}</span>
      <span class="tt-time">${secText(r.ms)}</span>
    </div>`).join('')}
    <div class="tt-row tt-total"><span class="tt-desc">이 문제 전체</span><span class="tt-time">${secText(total)}</span></div>
  </div>`;
}

/** 도전 완료 후 — 같은 이름의 단계끼리 묶은 평균 수행 시간 */
function summaryHTML() {
  if (!sessionLog.length) return '';
  const by = new Map();
  sessionLog.forEach(r => {
    const cur = by.get(r.desc) || { desc: r.desc, n: 0, ms: 0, wrong: 0 };
    cur.n++; cur.ms += r.ms; if (!r.ok) cur.wrong++;
    by.set(r.desc, cur);
  });
  const rows = [...by.values()].sort((a, b) => b.ms / b.n - a.ms / a.n);
  return `<div class="tt mt-4">
    <div class="tt-head">⏱ 단계별 평균 수행 시간 (오래 걸린 순)</div>
    ${rows.map(r => `<div class="tt-row">
      <span class="tt-desc">${r.desc}</span>
      <span class="tt-time">${secText(r.ms / r.n)}<span class="tt-sub"> · ${r.n}회${r.wrong ? ` · 오답 ${r.wrong}` : ''}</span></span>
    </div>`).join('')}
  </div>`;
}

/* ═══ 풀이판 ═══ */
function fill(key, html) {
  const el = document.getElementById('wb-' + key);
  if (!el) return;
  el.innerHTML = html;
  el.classList.remove('wb-empty');
  el.classList.add('wb-filled');
}

function boardHTML() {
  return `<div class="wb">${rows.map(k =>
    `<div class="wb-row"><span class="wb-label">${ROW_LABELS[k]}</span>
       <span class="wb-body ${k === 'orig' ? '' : 'wb-empty'}" id="wb-${k}">${k === 'orig' ? origHTML() : '?'}</span></div>`
  ).join('')}</div>`;
}

/** 문제 줄 (대분수 레벨은 대분수 표기로) */
function origHTML() {
  const p = prob;
  if (p.op === 'convert') {
    return p.dir === 'toMixed'
      ? `${fracHTML(p.improper)} <span class="q-op">→</span> <span class="wb-hint">대분수</span>`
      : `${mixedHTML(p.improper)} <span class="q-op">→</span> <span class="wb-hint">가분수</span>`;
  }
  const show = p.mixedInput ? mixedHTML : fracHTML;
  return `${show(p.A)}<span class="q-op">${p.sign}</span>${show(p.B)}`;
}

/* ═══ 스텝 구성 ═══ */
const stepNum   = (desc, q, exp, fn) => ({ type:'num',   desc, q, exp, fn });
const stepFrac  = (desc, q, exp, fn) => ({ type:'frac',  desc, q, exp, fn });
const stepMixed = (desc, q, exp, fn) => ({ type:'mixed', desc, q, exp, fn });
const stepYN    = (desc, q, exp, fn) => ({ type:'yn',    desc, q, exp, fn });
const stepAuto  = (desc, msg, fn)    => ({ type:'auto',  desc, msg, fn });

/** 약분 단계 (마지막에 reduce 줄을 채운다) */
function pushReduce(raw) {
  const g = gcd(raw.n, raw.d);
  const red = reduce(raw);
  steps.push(stepYN('약분 확인', `${fracHTML(raw)}${fracJosa(raw, '을', '를')} 약분할 수 있나요?`, g > 1));
  if (g > 1) {
    steps.push(stepNum('최대공약수 구하기', `${raw.n}${josa(raw.n, '과', '와')} ${raw.d}의 최대공약수는?`, g));
    steps.push(stepFrac('약분하기', `분자와 분모를 각각 ${g} 로 나누면?`, red, () => fill('reduce', fracHTML(red))));
  } else {
    steps.push(stepAuto('약분 확인', '더 이상 약분할 수 없어요 — 이미 기약분수!', () => fill('reduce', fracHTML(red))));
  }
  return red;
}

/** 통분 단계 (분모가 다를 때) — 통분된 두 분자를 돌려준다 */
function pushCommonDenom(A, B, sign) {
  const L = lcm(A.d, B.d);
  const x = A.n * (L / A.d), y = B.n * (L / B.d);
  steps.push(stepNum('최소공배수 구하기', `분모 ${A.d}${josa(A.d, '과', '와')} ${B.d}의 최소공배수는?`, L,
    () => fill('common', `${slot('?', L)}<span class="q-op">${sign}</span>${slot('?', L)}`)));
  steps.push(stepNum('통분하기 ①', `${fracHTML(A)}${fracJosa(A, '을', '를')} 분모 ${L}로 바꾸면 분자는?`, x,
    () => fill('common', `${fracHTML(F(x,L))}<span class="q-op">${sign}</span>${slot('?', L)}`)));
  steps.push(stepNum('통분하기 ②', `${fracHTML(B)}${fracJosa(B, '을', '를')} 분모 ${L}로 바꾸면 분자는?`, y,
    () => fill('common', `${fracHTML(F(x,L))}<span class="q-op">${sign}</span>${fracHTML(F(y,L))}`)));
  return { L, x, y };
}

/** 분자끼리 더하기/빼기 → calc 줄 */
function pushNumeratorAddSub(x, y, denom, sign) {
  const n = sign === '+' ? x + y : x - y;
  const raw = F(n, denom);
  steps.push(stepNum('분자끼리 계산', `분모는 그대로 두고 <b>${x} ${sign} ${y}</b> = ?`, n,
    () => fill('calc', fracHTML(raw))));
  return raw;
}

/** 분자끼리·분모끼리 곱하기 → calc 줄 */
function pushMultiply(A, B) {
  const n = A.n * B.n, d = A.d * B.d, raw = F(n, d);
  steps.push(stepNum('분자끼리 곱하기', `${A.n} × ${B.n} = ?`, n));
  steps.push(stepNum('분모끼리 곱하기', `${A.d} × ${B.d} = ?`, d, () => fill('calc', fracHTML(raw))));
  return raw;
}

function buildSteps() {
  const p = prob;
  steps = [];

  if (p.op === 'convert') return buildConvertSteps(p);

  const isMixedLevel = !!p.mixedInput;
  const isDiv  = false;                      // 나눗셈 과정 레벨은 현재 커리큘럼에 없음
  const isMul  = false;
  const isAdd  = /-add/.test(p.op) || /^same-add/.test(p.op);

  rows = ['orig'];
  if (isMixedLevel) rows.push('improper');
  if (isDiv) rows.push('flip');

  let A = p.A, B = p.B;

  /* ① 대분수 → 가분수 */
  if (isMixedLevel) {
    steps.push(stepFrac('가분수로 고치기 ①', `${mixedHTML(p.A)}${mixedJosa(p.A, '을', '를')} 가분수로 고치면?`, p.A));
    if (isImproper(p.B) || p.B.d === 1 || toMixed(p.B).w !== 0) {
      steps.push(stepFrac('가분수로 고치기 ②', `${mixedHTML(p.B)}${mixedJosa(p.B, '을', '를')} 가분수로 고치면?`, p.B,
        () => fill('improper', `${fracHTML(p.A)}<span class="q-op">${p.sign}</span>${fracHTML(p.B)}`)));
    } else {
      steps.push(stepAuto('가분수로 고치기 ②', `${fracText(p.B)}${fracJosa(p.B, '은', '는')} 이미 진분수예요. 그대로 두면 됩니다.`,
        () => fill('improper', `${fracHTML(p.A)}<span class="q-op">${p.sign}</span>${fracHTML(p.B)}`)));
    }
  }

  let raw;
  if (isMul || isDiv) {
    /* ② 나눗셈이면 뒤집어서 곱셈으로 */
    if (isDiv) {
      const flipped = recip(B);
      steps.push(stepFrac('나눗셈을 곱셈으로', `÷를 ×로 바꾸려면 ${fracHTML(B)}${fracJosa(B, '을', '를')} 어떻게 바꿔야 하나요?`, flipped,
        () => fill('flip', `${fracHTML(A)}<span class="q-op">×</span>${fracHTML(flipped)}`)));
      B = flipped;
    }
    rows.push('calc', 'reduce');
    raw = pushMultiply(A, B);
  } else {
    const sign = isAdd ? '+' : '−';
    const sameDenom = A.d === B.d;
    steps.push(stepYN('분모 확인', '두 분수의 <b>분모가 같나요?</b>', sameDenom));
    if (sameDenom) {
      rows.push('calc', 'reduce');
      raw = pushNumeratorAddSub(A.n, B.n, A.d, sign);
    } else {
      rows.push('common', 'calc', 'reduce');
      const c = pushCommonDenom(A, B, sign);
      raw = pushNumeratorAddSub(c.x, c.y, c.L, sign);
    }
  }

  /* ③ 약분 */
  const red = pushReduce(raw);

  /* ④ 대분수로 되돌리기 — 대분수 레벨이거나 답이 1을 넘으면 */
  if (isMixedLevel || isImproper(red)) {
    rows.push('answer');
    steps.push(stepMixed('대분수로 나타내기', `${fracHTML(red)}${fracJosa(red, '을', '를')} 대분수로 고치면?`, red,
      () => fill('answer', mixedHTML(red))));
    prob.answerIsMixed = true;
  }
  prob.answer = red;
}

function buildConvertSteps(p) {
  const imp = p.improper, m = toMixed(imp);
  if (p.dir === 'toMixed') {
    rows = ['orig', 'calc', 'answer'];
    steps.push(stepNum('몫 구하기', `${imp.n} ÷ ${imp.d} 의 <b>몫</b>은?`, m.w));
    steps.push(stepNum('나머지 구하기', `${imp.n} ÷ ${imp.d} 의 <b>나머지</b>는?`, m.n,
      () => fill('calc', `몫 <b>${m.w}</b> · 나머지 <b>${m.n}</b>`)));
    steps.push(stepMixed('대분수로 쓰기', '대분수로 나타내면?', imp, () => fill('answer', mixedHTML(imp))));
  } else {
    rows = ['orig', 'calc', 'answer'];
    steps.push(stepNum('정수 × 분모', `${m.w} × ${imp.d} = ?`, m.w * imp.d));
    steps.push(stepNum('분자 더하기', `${m.w * imp.d} + ${m.n} = ?`, imp.n,
      () => fill('calc', `분자 = <b>${imp.n}</b>`)));
    steps.push(stepFrac('가분수로 쓰기', '가분수로 나타내면?', imp, () => fill('answer', fracHTML(imp))));
  }
  prob.answer = imp;
}

/* ═══ 렌더 ═══ */
function render() {
  const area = document.getElementById('practiceArea');
  area.classList.remove('hidden');
  area.innerHTML = `${Session.headerHTML()}
    <div class="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
      <div class="text-center text-xs text-gray-400 font-black mb-3 tracking-widest">${cfg.label}</div>
      ${boardHTML()}
      <div id="stepQArea" class="mt-5"></div>
    </div>`;
}

/* ═══ 입력 위젯 ═══ */
function inputHTML(type) {
  if (type === 'yn') {
    return `<div class="flex justify-center gap-4">
      <button class="yn-btn yn-yes" onclick="StepFrac.answerYN(true)">⭕ 예</button>
      <button class="yn-btn yn-no" onclick="StepFrac.answerYN(false)">❌ 아니오</button>
    </div>`;
  }
  const box = (id, ph) => `<input type="text" inputmode="numeric" id="${id}" placeholder="${ph}" class="fi-box" autocomplete="off"/>`;
  if (type === 'num') {
    return `<div class="flex justify-center gap-3 items-center">
      ${box('fiNum', '')}
      <button onclick="StepFrac.submit()" class="btn-check">확인</button>
    </div>`;
  }
  const whole = type === 'mixed' ? box('fiW', '정수') : '';
  return `<div class="flex justify-center gap-3 items-center">
    <div class="fi">${whole}
      <div class="fi-frac">${box('fiN', '분자')}<div class="fi-bar"></div>${box('fiD', '분모')}</div>
    </div>
    <button onclick="StepFrac.submit()" class="btn-check">확인</button>
  </div>`;
}

function wireInputs(type) {
  const order = type === 'num' ? ['fiNum'] : type === 'mixed' ? ['fiW','fiN','fiD'] : ['fiN','fiD'];
  order.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const nextEl = document.getElementById(order[i + 1]);
      if (nextEl && !nextEl.value.trim()) nextEl.focus(); else submit();
    });
  });
  const first = document.getElementById(order[0]);
  if (first) first.focus();
}

/* ═══ 스텝 표시 ═══ */
function showStep() {
  if (idx >= steps.length) return onProbDone();
  const s = steps[idx], cl = PAL[idx % PAL.length], qa = document.getElementById('stepQArea');

  if (s.type === 'auto') {
    stopStepClock();
    if (s.fn) s.fn();
    qa.innerHTML = `<div style="background:${cl.bg};border:1.5px solid ${cl.bd};" class="p-4 rounded-2xl text-center">
      <div class="text-sm font-bold mb-1" style="color:${cl.tx}">${s.desc}</div>
      <div class="text-lg font-black text-gray-800">${s.msg}</div>
    </div>`;
    setTimeout(() => { idx++; showStep(); }, 900);
    return;
  }

  qa.innerHTML = `<div style="background:${cl.bg};border:1.5px solid ${cl.bd};" class="p-5 rounded-2xl text-center">
    <div class="flex flex-wrap items-center justify-center gap-2 mb-3">
      <span style="background:${cl.badge};color:${cl.tx};" class="inline-flex items-center rounded-full px-3 py-1 text-xs font-black whitespace-nowrap">STEP ${idx + 1}</span>
      <span style="color:${cl.tx};" class="text-sm font-bold">${s.desc}</span>
      <span id="stepClock" style="background:${cl.badge};color:${cl.tx};" class="st-clock">⏱ 0.0초</span>
    </div>
    <div class="step-q">${s.q}</div>
    ${inputHTML(s.type)}
    <div id="stepFb" class="min-h-8 mt-3 font-bold text-lg"></div>
  </div>`;
  startStepClock();
  if (s.type !== 'yn') wireInputs(s.type);
}

/* ═══ 채점 ═══ */
function readValue(type) {
  const val = id => (document.getElementById(id) || {}).value;
  if (type === 'num') {
    const raw = (val('fiNum') || '').trim();
    if (!/^-?\d+$/.test(raw)) return null;
    return parseInt(raw, 10);
  }
  const n = (val('fiN') || '').trim(), d = (val('fiD') || '').trim();
  if (!/^\d+$/.test(n) || !/^[1-9]\d*$/.test(d)) return null;
  if (type === 'frac') return F(parseInt(n, 10), parseInt(d, 10));
  const w = (val('fiW') || '').trim();
  if (!/^\d+$/.test(w)) return null;
  return { mixed: true, w: parseInt(w, 10), n: parseInt(n, 10), d: parseInt(d, 10) };
}

function judge(type, got, exp) {
  if (type === 'num')  return { ok: got === exp };
  if (type === 'frac') {
    if (eqExact(got, exp)) return { ok: true };
    if (eqValue(got, exp)) return { ok: false, note: '값은 맞아요! 하지만 <b>기약분수</b>로 약분해야 합니다.' };
    return { ok: false };
  }
  // mixed: 정수부·분자·분모가 정확히 일치해야 함 (기약 + 대분수 형태)
  const m = toMixed(exp);
  if (got.w === m.w && got.n === m.n && got.d === m.d) return { ok: true };
  const v = fromMixed(got.w, got.n, got.d);
  if (eqValue(v, exp)) return { ok: false, note: '값은 맞아요! <b>기약분수인 대분수</b>로 다시 써 보세요.' };
  return { ok: false };
}

function expectedHTML(type, exp) {
  if (type === 'num')  return `<b>${exp}</b>`;
  if (type === 'frac') return fracHTML(exp);
  return mixedHTML(exp);
}

function submit() {
  if (waiting) return;
  const s = steps[idx], fb = document.getElementById('stepFb');
  const got = readValue(s.type);
  if (got === null) { fb.innerHTML = '<span class="text-gray-500 text-base">칸을 모두 채워 주세요.</span>'; return; }
  const r = judge(s.type, got, s.exp);
  finishStep(r.ok, fb, s, r.note);
}

function answerYN(v) {
  if (waiting) return;
  const s = steps[idx], fb = document.getElementById('stepFb');
  finishStep(v === s.exp, fb, s, null, true);
}

function finishStep(ok, fb, s, note, isYN) {
  waiting = true;
  const ms = Date.now() - stepStart;
  stopStepClock();
  stepLog.push({ no: idx + 1, desc: s.desc, ms, ok });
  const took = `<div class="text-sm font-bold text-gray-400 mt-1">⏱ 수행 시간 ${secText(ms)}</div>`;
  if (s.fn) s.fn();                                   // 맞든 틀리든 풀이판은 정답으로 진행
  if (ok) {
    fb.innerHTML = '<span class="text-green-600">정답! ⭕</span>' + took;
    setTimeout(() => { waiting = false; idx++; showStep(); }, 600);
  } else {
    probOK = false;
    const answer = isYN ? `<b>${s.exp ? '예' : '아니오'}</b>` : expectedHTML(s.type, s.exp);
    fb.innerHTML = `<span class="text-red-500">틀렸어요 ❌ 정답: ${answer}</span>` +
                   (note ? `<div class="text-sm text-amber-600 mt-1">${note}</div>` : '') + took;
    setTimeout(() => { waiting = false; idx++; showStep(); }, note ? 1800 : 1200);
  }
}

/* ═══ 문제 완료 ═══ */
function onProbDone() {
  stopStepClock();
  const board = timeBoardHTML();
  sessionLog = sessionLog.concat(stepLog);
  const done = Session.problemDone(probOK);
  if (done) {
    document.getElementById('stepQArea').innerHTML = Session.finishHTML() + summaryHTML();
    Session.saveResult();
    return;
  }
  const p = prob;
  const ansHTML = p.answerIsMixed || p.mixedInput ? mixedHTML(p.answer) : fracHTML(p.answer);
  document.getElementById('stepQArea').innerHTML = `
    <div class="bg-green-50 p-6 rounded-2xl border-2 border-green-200 text-center">
      <div class="text-4xl mb-2">${probOK ? '🎉' : '💪'}</div>
      <div class="text-xl font-black text-green-700 mb-2">${probOK ? '잘했어요!' : '한 번 더 해볼까요?'}</div>
      <div class="text-gray-500 mb-4 flex items-center justify-center gap-2 flex-wrap">${origHTML()}<span class="q-op">=</span>${ansHTML}</div>
      ${board}
      <button onclick="StepFrac.next()" class="px-8 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition text-lg shadow-md active:scale-95">다음 문제 ▶</button>
    </div>`;
}

return { init, submit, answerYN, next };
})();
