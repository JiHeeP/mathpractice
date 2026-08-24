/* step-int.js — 정수 세로셈 엔진 (L1 두자리수×한자리수, L2 두자리수÷한자리수) */
const StepInt = (() => {
const { randInt } = window.Frac;
const PAL = [
  { bg:'#fff7ed', bd:'#fed7aa', badge:'#ffedd5', tx:'#c2410c' },
  { bg:'#fef2f2', bd:'#fecaca', badge:'#fee2e2', tx:'#b91c1c' },
  { bg:'#ecfdf5', bd:'#a7f3d0', badge:'#d1fae5', tx:'#047857' },
  { bg:'#eff6ff', bd:'#bfdbfe', badge:'#dbeafe', tx:'#1d4ed8' },
  { bg:'#f5f3ff', bd:'#ddd6fe', badge:'#ede9fe', tx:'#6d28d9' },
  { bg:'#fdf2f8', bd:'#fbcfe8', badge:'#fce7f3', tx:'#be185d' }
];

let level, cfg, prob, steps, idx, probOK, waiting;

function init(lv, mode, config, onExit) {
  level = lv; cfg = config;
  Session.start(lv, mode, config, 'int', onExit);
  next();
}

function next() {
  prob = Gen.generateStepProblem(level);
  idx = 0; probOK = true; waiting = false;
  buildSteps();
  render();
  Session.startTimer();
  showStep();
}

/* ═══ 공통 셀 조작 ═══ */
/** 오른쪽 끝을 rightCol 에 맞춰 숫자를 채운다 */
function fillDigits(prefix, num, rightCol, extraCls) {
  const s = String(num);
  for (let i = 0; i < s.length; i++) {
    const col = rightCol - s.length + 1 + i;
    if (col < 0) continue;
    const el = document.getElementById(`${prefix}${col}`);
    if (!el) continue;
    el.textContent = s[i];
    el.classList.remove('cg-empty', 'dg-mt');
    el.classList.add('cg-filled');
    if (extraCls) el.classList.add(extraCls);
  }
}

/* ═══════════ 곱셈 (두자리수 × 한자리수) ═══════════ */
const MULT_COLS = 4;

function multGrid() {
  const p = prob;
  const top = padCells(p.a, MULT_COLS);
  const bottom = new Array(MULT_COLS).fill('');
  bottom[0] = '×'; bottom[MULT_COLS - 1] = String(p.b);
  let h = '<div class="flex justify-center my-4"><table class="cg-table">';
  h += '<tr class="cg-carry-row">';
  for (let c = 0; c < MULT_COLS; c++) h += `<td id="mc${c}"></td>`;
  h += '</tr><tr>';
  for (let c = 0; c < MULT_COLS; c++) h += `<td class="cg-cell ${top[c] ? 'cg-given' : 'cg-empty'}">${top[c]}</td>`;
  h += '</tr><tr>';
  for (let c = 0; c < MULT_COLS; c++) {
    const cls = c === 0 ? 'cg-sign cg-sep' : bottom[c] ? 'cg-given cg-sep' : 'cg-empty cg-sep';
    h += `<td class="cg-cell ${cls}">${bottom[c]}</td>`;
  }
  h += '</tr><tr>';
  for (let c = 0; c < MULT_COLS; c++) h += `<td class="cg-cell cg-ans cg-empty" id="ma${c}"></td>`;
  return h + '</tr></table></div>';
}

function padCells(n, width) {
  const s = String(n), arr = new Array(width).fill('');
  for (let i = 0; i < s.length; i++) arr[width - s.length + i] = s[i];
  return arr;
}

function showCarry(v) {
  const el = document.getElementById('mc2');
  if (el && v > 0) el.innerHTML = `<span class="carry-badge">${v}</span>`;
}

function buildMultSteps() {
  const p = prob;
  steps = [
    { desc:'일의 자리끼리 곱하기', q:`${p.aOnes} × ${p.b} = ?`, exp:p.onesProd,
      fn:() => fillDigits('ma', p.onesDigit, MULT_COLS - 1) },
    { desc:'올림 수 구하기', q:`일의 자리에 ${p.onesDigit} 을(를) 쓰고, 십의 자리로 올리는 수는?`, exp:p.carry,
      fn:() => showCarry(p.carry) },
    { desc:'십의 자리끼리 곱하기', q:`${p.aTens} × ${p.b} = ?`, exp:p.tensProd,
      fn:() => { if (p.carry === 0) fillDigits('ma', p.ans, MULT_COLS - 1); } }
  ];
  if (p.carry > 0) {
    steps.push({ desc:'올림까지 더하기', q:`${p.tensProd} + ${p.carry} = ?`, exp:p.tensWithCarry,
      fn:() => fillDigits('ma', p.ans, MULT_COLS - 1) });
  }
}

/* ═══════════ 나눗셈 (두자리수 ÷ 한자리수) ═══════════ */
function divGrid() {
  const p = prob;
  const dvD = p.dvStr.split(''), ddD = p.ddStr.split('');
  const dvW = dvD.length, ddW = ddD.length;
  const rounds = String(p.q).length;
  let h = '<div class="dg-wrap"><table class="dg-table">';

  h += '<tr>';                                            // 몫
  for (let c = 0; c < dvW; c++) h += '<td class="dg-cell dg-mt"></td>';
  for (let c = 0; c < ddW; c++) h += `<td class="dg-cell dg-mt dg-q" id="dq${c}"></td>`;
  h += '</tr><tr>';                                       // 제수 | 피제수
  for (let c = 0; c < dvW; c++) h += `<td class="dg-cell dg-dv">${dvD[c]}</td>`;
  for (let c = 0; c < ddW; c++) h += `<td class="dg-cell dg-dd dg-bt${c === 0 ? ' dg-bs' : ''}">${ddD[c]}</td>`;
  h += '</tr>';
  for (let r = 0; r < rounds; r++) {                      // 빼기 · 나머지 행
    h += '<tr>';
    for (let c = 0; c < dvW; c++) h += '<td class="dg-cell dg-mt"></td>';
    for (let c = 0; c < ddW; c++) h += `<td class="dg-cell dg-sub dg-mt" id="ds${r}_${c}"></td>`;
    h += '</tr><tr>';
    for (let c = 0; c < dvW; c++) h += '<td class="dg-cell dg-mt"></td>';
    for (let c = 0; c < ddW; c++) h += `<td class="dg-cell dg-rem dg-mt" id="dr${r}_${c}"></td>`;
    h += '</tr>';
  }
  return h + '</table></div>';
}

function addSepLine(round, leftCol, rightCol) {
  for (let c = leftCol; c <= rightCol; c++) {
    const el = document.getElementById(`ds${round}_${c}`);
    if (el) el.classList.add('dg-ssep');
  }
}

function buildDivSteps() {
  const p = prob;
  const digits = p.ddStr.split('').map(Number), dv = p.dv;
  const qLen = String(p.q).length;
  steps = [];
  let current = 0, started = false, qCol = digits.length - qLen, round = 0;

  for (let i = 0; i < digits.length; i++) {
    current = current * 10 + digits[i];
    if (i > 0 && started) {
      const d = digits[i], cur = current;
      steps.push({ type:'auto', desc:'다음 숫자 내리기', msg:`${d} 을(를) 내려서 ${cur}`, fn:() => {} });
    }
    const fits = current >= dv;
    steps.push({ type:'yn', desc:'나눌 수 있는지 확인', q:`${current} 안에 ${dv} 이(가) 들어가나요?`, exp:fits, fn:() => {} });

    if (!fits) {
      if (started) {
        const col = qCol++;
        steps.push({ type:'auto', desc:'몫에 0 쓰기', msg:'나눌 수 없으므로 몫에 0을 씁니다',
          fn:() => fillDigits('dq', 0, col) });
      }
      continue;
    }

    started = true;
    const qd = Math.floor(current / dv), prod = dv * qd, rem = current - prod;
    const rc = i, rnd = round, col = qCol++;
    const left = Math.max(0, rc - String(prod).length + 1);
    const rest = digits.slice(i + 1);

    steps.push({ desc:'몫 구하기', q:`${current} 안에 ${dv} 이(가) 몇 번 들어가나요?`, exp:qd,
      fn:() => fillDigits('dq', qd, col) });
    steps.push({ desc:'곱해서 확인', q:`${dv} × ${qd} = ?`, exp:prod,
      fn:() => { fillDigits(`ds${rnd}_`, prod, rc, 'dg-sub'); addSepLine(rnd, left, rc); } });
    steps.push({ desc:'빼서 나머지 구하기', q:`${current} − ${prod} = ?`, exp:rem,
      fn:() => {
        fillDigits(`dr${rnd}_`, rem, rc, 'dg-rem');
        rest.forEach((d, j) => fillDigits(`dr${rnd}_`, d, rc + 1 + j, 'dg-rem'));
      } });
    round++;
    current = rem;
  }
}

/* ═══ 공통 ═══ */
function buildSteps() { cfg.engine === 'int-mult' ? buildMultSteps() : buildDivSteps(); }
function gridHTML()  { return cfg.engine === 'int-mult' ? multGrid() : divGrid(); }
function titleText() { return cfg.engine === 'int-mult' ? `${prob.a} × ${prob.b}` : `${prob.dd} ÷ ${prob.dv}`; }

function render() {
  const area = document.getElementById('practiceArea');
  area.classList.remove('hidden');
  area.innerHTML = `${Session.headerHTML()}
    <div class="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
      <div class="text-center text-lg text-gray-400 font-black mb-1 tracking-widest">${titleText()}</div>
      ${gridHTML()}
      <div id="stepQArea" class="mt-5"></div>
    </div>`;
}

function showStep() {
  if (idx >= steps.length) return onProbDone();
  const s = steps[idx], cl = PAL[idx % PAL.length], qa = document.getElementById('stepQArea');

  if (s.type === 'auto') {
    s.fn();
    qa.innerHTML = `<div style="background:${cl.bg};border:1.5px solid ${cl.bd};" class="p-4 rounded-2xl text-center">
      <div class="text-sm font-bold mb-1" style="color:${cl.tx}">${s.desc}</div>
      <div class="text-lg font-black text-gray-800">${s.msg}</div></div>`;
    setTimeout(() => { idx++; showStep(); }, 1400);
    return;
  }

  const input = s.type === 'yn'
    ? `<div class="flex justify-center gap-4">
         <button class="yn-btn yn-yes" onclick="StepInt.answerYN(true)">⭕ 예</button>
         <button class="yn-btn yn-no" onclick="StepInt.answerYN(false)">❌ 아니오</button>
       </div>`
    : `<div class="flex justify-center gap-3 items-center">
         <input type="text" inputmode="numeric" id="fiNum" class="fi-box" autocomplete="off"
                onkeydown="if(event.key==='Enter'){event.preventDefault();StepInt.submit();}"/>
         <button onclick="StepInt.submit()" class="btn-check">확인</button>
       </div>`;

  qa.innerHTML = `<div style="background:${cl.bg};border:1.5px solid ${cl.bd};" class="p-5 rounded-2xl text-center">
    <div class="flex items-center justify-center gap-2 mb-3">
      <span style="background:${cl.badge};color:${cl.tx};" class="inline-flex items-center rounded-full px-3 py-1 text-xs font-black">STEP ${idx + 1}</span>
      <span style="color:${cl.tx};" class="text-sm font-bold">${s.desc}</span>
    </div>
    <div class="step-q">${s.q}</div>
    ${input}
    <div id="stepFb" class="min-h-8 mt-3 font-bold text-lg"></div>
  </div>`;
  const el = document.getElementById('fiNum');
  if (el) el.focus();
}

function submit() {
  if (waiting) return;
  const s = steps[idx], fb = document.getElementById('stepFb');
  const raw = (document.getElementById('fiNum').value || '').trim();
  if (!/^-?\d+$/.test(raw)) { fb.innerHTML = '<span class="text-gray-500 text-base">숫자를 입력해 주세요.</span>'; return; }
  finish(parseInt(raw, 10) === s.exp, fb, `<b>${s.exp}</b>`);
}

function answerYN(v) {
  if (waiting) return;
  const s = steps[idx], fb = document.getElementById('stepFb');
  finish(v === s.exp, fb, `<b>${s.exp ? '예' : '아니오'}</b>`);
}

function finish(ok, fb, expHTML) {
  waiting = true;
  const s = steps[idx];
  if (s.fn) s.fn();
  if (ok) {
    fb.innerHTML = '<span class="text-green-600">정답! ⭕</span>';
    setTimeout(() => { waiting = false; idx++; showStep(); }, 700);
  } else {
    probOK = false;
    fb.innerHTML = `<span class="text-red-500">틀렸어요 ❌ 정답: ${expHTML}</span>`;
    setTimeout(() => { waiting = false; idx++; showStep(); }, 2200);
  }
}

function onProbDone() {
  if (Session.problemDone(probOK)) {
    document.getElementById('stepQArea').innerHTML = Session.finishHTML();
    Session.saveResult();
    return;
  }
  const p = prob;
  const result = cfg.engine === 'int-mult'
    ? `<b class="text-green-700 text-xl">${p.ans}</b>`
    : (p.r > 0 ? `몫 <b class="text-indigo-700">${p.q}</b>, 나머지 <b class="text-purple-600">${p.r}</b>`
               : `몫 <b class="text-indigo-700">${p.q}</b> (나누어떨어짐!)`);
  document.getElementById('stepQArea').innerHTML = `
    <div class="bg-green-50 p-6 rounded-2xl border-2 border-green-200 text-center">
      <div class="text-4xl mb-2">${probOK ? '🎉' : '💪'}</div>
      <div class="text-xl font-black text-green-700 mb-1">${probOK ? '잘했어요!' : '한 번 더 해볼까요?'}</div>
      <div class="text-gray-500 mb-5">${titleText()} = ${result}</div>
      <button onclick="StepInt.next()" class="px-8 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition text-lg shadow-md active:scale-95">다음 문제 ▶</button>
    </div>`;
}

return { init, submit, answerYN, next };
})();
