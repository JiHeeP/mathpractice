/* numinput.js — 숫자 직접 입력 엔진 (기초 연산 B1~B10)
 * 문제는 generator.js 의 generateNumProblem 이 만든 { display, fields:[{label, ans, list?, grow?, auto?}] }.
 * 화면 숫자판(js/numpad.js — 0~9 · 지우기 · 다음 칸/확인)으로 칸을 채운다. 키보드로 쳐도 된다.
 *
 * 칸 = 수 하나. 문제 유형마다 칸 모양이 다르다 (선생님 결정 2026-11-17)
 *   - 몫·나머지: "126 ÷ 5 = [몫] … [나머지]" 한 줄. '다음 칸'으로 나머지로 간다. 나머지 크기 경고는 하지 않는다
 *   - 약수(grow): 수마다 칸 하나. 칸을 채우고 '다음 칸'을 누르면 새 칸이 생긴다. 약수 개수는 미리 보여 주지 않는다
 *     빈 칸에서 '확인'. 빈 칸에서 지우기를 누르면 그 칸이 없어지고 앞 칸으로 간다
 *   - 배수·공배수(list): 문제에 나온 개수만큼 칸을 미리 보여 준다(개수는 문제에 이미 있다)
 *   - 한 자리 답(auto, B5): 숫자 하나를 누르면 바로 채점한다(확인 키 없음)
 *   - 세로셈(vert, B1~B4): 문제를 세로로 쓰고, 답은 자릿수 칸에 채운다.
 *     B1(뺄셈, vert.rtl)만 일의 자리부터 왼쪽으로, B2~B4 는 앞(높은 자리)부터 오른쪽으로
 *   - 도움 칸(학생이 켤 때만): B9 는 '□ × □ = n' 짝 줄, B4 는 부분곱 두 줄(채점하지 않음, 맨 아래 답만 채점)
 *   - 소수(dec, D1~D5): 숫자판에 소수점(.) 키. 빈 칸에서 누르면 '0.' 이 된다. 값이 같으면 정답(6.0 · 1.20 도 정답,
 *     대신 '끝자리 0은 지워요' 안내 — 선생님 결정 2026-11-18). D1~D4 도움 칸: '자연수처럼 곱하면 □ → 소수점 아래 □자리'
 * 계산은 학생이 한다. 화면은 칸 옮기기·지우기만 돕는다.
 * 4지선다와 달리 찍을 수 없으므로 오답 시간 페널티는 두지 않는다.
 */
const NumInput = (() => {
let level, cfg, prob, boxes, cur, waiting, marks, helpOn = false;
/* 도움 칸이 있는 레벨 — 기본은 꺼 두고 학생이 켠다(선생님 결정 2026-11-17 B1). 켜 두면 그 판 동안 유지 */
const HELP = { B4: '부분곱 칸', B9: '짝 찾기 칸', D1: '자릿수 도움 칸', D2: '자릿수 도움 칸', D3: '자릿수 도움 칸', D4: '자릿수 도움 칸' };

function init(lv, mode, config, onExit) {
  level = lv; cfg = config; helpOn = false;
  Session.start(lv, mode, config, 'num', onExit);
  const area = document.getElementById('practiceArea');
  area.classList.remove('hidden');
  area.innerHTML = `${Session.headerHTML()}${Scratch.wrap(cfg, `
    <div class="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
      <div class="text-center text-xs text-gray-400 font-black mb-4 tracking-widest">${cfg.label}</div>
      <div id="numBody"></div>
    </div>`)}`;
  Scratch.mount();
  Session.startTimer();
  next();
}

/* 칸 목록 — { f: 몇 번째 field, v: 쓴 수(문자열), k: 'n' 수 | 'd' 자릿수 한 칸 | 'opt' 도움 칸(채점 안 함) } */
function makeBoxes() {
  const out = [];
  prob.fields.forEach((f, i) => {
    if (f.vert) {
      if (helpOn && HELP[level]) for (let r = 0; r < 2; r++) out.push({ f: i, v: '', k: 'opt' });
      for (let d = 0; d < String(f.ans).length; d++) out.push({ f: i, v: '', k: 'd' });
      return;
    }
    if (f.dec && helpOn && HELP[level]) for (let r = 0; r < 2; r++) out.push({ f: i, v: '', k: 'opt' });
    const n = f.list && !f.grow ? f.ans.length : (f.grow && pairs() ? 2 : 1);
    for (let k = 0; k < n; k++) out.push({ f: i, v: '', k: 'n' });
  });
  return out;
}
const pairs = () => helpOn && level === 'B9';             // 약수 짝 줄
const rtl = () => !!(prob.fields[0].vert && prob.fields[0].vert.rtl);   // 자릿수 칸을 일의 자리부터(B1)
const dStep = () => rtl() ? -1 : 1;                                     // 숫자를 쓰면 옮겨 갈 방향
const firstCur = () => { const d = boxes.findIndex(x => x.k === 'opt'); if (d !== -1) return d;
  const ds = boxes.map((x, b) => b).filter(b => boxes[b].k === 'd'); return ds.length ? (rtl() ? ds[ds.length - 1] : ds[0]) : 0; };
const firstEmptyDigit = () => { const ds = boxes.map((x, b) => b).filter(b => boxes[b].k === 'd' && !boxes[b].v);
  return ds.length ? (rtl() ? ds[ds.length - 1] : ds[0]) : -1; };
const fieldOf = b => prob.fields[boxes[b].f];
const isGrow = b => !!fieldOf(b).grow;
const isQR = () => prob.fields.length === 2 && prob.fields[0].label === '몫';
const isAuto = () => prob.fields.length === 1 && !!prob.fields[0].auto;
const isDec = () => prob.fields.some(f => f.dec);
/** '으로/로' — 읽었을 때 끝 글자에 ㄹ 아닌 받침이 있으면 '으로' (영·삼·육, 십·백·천). 일·칠·팔(ㄹ)과 받침 없는 수는 '로' */
const uro = n => /[036]$/.test(String(n)) ? '으로' : '로';

function next() {
  prob = Gen.generateNumProblem(level);
  boxes = makeBoxes();
  cur = firstCur(); waiting = false; marks = null;
  Scratch.clear();
  document.getElementById('numBody').innerHTML = `
    ${HELP[level] ? `<div class="text-center mb-2"><button type="button" id="numHelp" class="num-help">${helpOn ? '✓ ' : ''}${HELP[level]} ${helpOn ? '끄기' : '켜기'}</button></div>` : ''}
    <div id="numStage"></div>
    <div id="numFb" class="min-h-8 mt-2 text-center font-bold text-lg"></div>
    ${NumPad.html(isAuto() ? { noGo: true } : isDec() ? { extra: '.', extraLabel: '.' } : {})}`;
  NumPad.bind(document.getElementById('numBody'), press);
  const hb = document.getElementById('numHelp');
  if (hb) hb.onclick = toggleHelp;
  paint();
}

/** 도움 칸 켜기/끄기 — 쓴 수는 남긴다(약수), 부분곱 칸은 새로 그린다 */
function toggleHelp() {
  if (waiting) return;
  helpOn = !helpOn;
  const keep = boxes.filter(x => x.k === 'n' && x.v).map(x => x.v);
  const digits = boxes.filter(x => x.k === 'd').map(x => x.v);
  const nums = boxes.filter(x => x.k === 'n').map(x => x.v);
  boxes = makeBoxes();
  if (level === 'B9') {
    const f = boxes[0].f;
    boxes = keep.map(v => ({ f, v, k: 'n' }));
    if (!boxes.length || pairs()) boxes.push({ f, v: '', k: 'n' });
    if (pairs() && boxes.length % 2) boxes.push({ f, v: '', k: 'n' });
    cur = boxes.findIndex(x => !x.v);
  } else {
    boxes.filter(x => x.k === 'd').forEach((x, i) => { x.v = digits[i] || ''; });
    boxes.filter(x => x.k === 'n').forEach((x, i) => { x.v = nums[i] || ''; });
    cur = firstCur();
  }
  const hb = document.getElementById('numHelp');
  if (hb) hb.textContent = `${helpOn ? '✓ ' : ''}${HELP[level]} ${helpOn ? '끄기' : '켜기'}`;
  paint();
}

function boxHTML(b) {
  const f = fieldOf(b), cls = ['num-field'];
  if (f.list) cls.push('num-item');
  if (boxes[b].k === 'd') cls.push('num-digit');
  if (boxes[b].k === 'opt') cls.push('num-opt');
  if (b === cur && !waiting) cls.push('on');
  if (marks) cls.push(marks[b]);
  const lbl = f.label && boxes[b].k === 'n' ? `<span class="num-lbl">${f.label}</span>` : '';
  return `<button type="button" class="${cls.join(' ')}" data-b="${b}">${lbl}<span class="num-val">${boxes[b].v}</span></button>`;
}

function paint() {
  const stage = document.getElementById('numStage');
  if (!stage) return;
  const shown = boxes.map((x, b) => b).filter(b => !(marks && isGrow(b) && !boxes[b].v));   // 채점 뒤에는 남은 빈 칸을 숨긴다
  const f0 = prob.fields[0];
  if (f0.vert) {
    const { a, op, b } = f0.vert;
    const cells = n => String(n).split('').map(c => `<span class="vt-c">${c}</span>`).join('');   // 자릿수 칸과 같은 폭으로 줄 맞춤
    const opts = shown.filter(x => boxes[x].k === 'opt'), ds = shown.filter(x => boxes[x].k === 'd');
    const optRows = opts.map((x, r) => `<span></span><span class="vt-opt" style="padding-right:${r * 2.85}rem">${boxHTML(x)}</span>`).join('');
    stage.innerHTML = `<div class="vt">
      <span></span><span class="vt-num">${cells(a)}</span>
      <span class="q-op">${op}</span><span class="vt-num">${cells(b)}</span>
      <span class="vt-rule"></span>
      ${optRows}${opts.length ? '<span class="vt-rule"></span>' : ''}
      <span></span><span class="vt-ans">${ds.map(boxHTML).join('')}</span>
    </div>`;
  } else if (pairs()) {
    const n = (prob.display.match(/\d+/) || [''])[0];
    let rows = '';
    for (let r = 0; r < shown.length; r += 2) rows += `<div class="num-pair">${boxHTML(shown[r])}<span class="q-op">×</span>${shown[r + 1] !== undefined ? boxHTML(shown[r + 1]) : ''}<span class="q-op">= ${n}</span></div>`;
    stage.innerHTML = `<div class="text-center mb-3"><div class="quiz-q num-q">${prob.display}</div></div><div class="num-pairs">${rows}</div>`;
  } else if (isDec()) {
    const opts = shown.filter(x => boxes[x].k === 'opt'), ans = shown.find(x => boxes[x].k === 'n');
    stage.innerHTML = `<div class="quiz-q num-q num-line">${prob.display}${boxHTML(ans)}</div>
      ${opts.length ? `<div class="num-dhelp">자연수처럼 곱하면 ${boxHTML(opts[0])} <span class="q-op">→</span> 소수점 아래 ${boxHTML(opts[1])}자리</div>` : ''}`;
  } else if (isQR()) {
    stage.innerHTML = `<div class="quiz-q num-q num-line">${prob.display}${boxHTML(0)}<span class="q-op">…</span>${boxHTML(1)}</div>`;
  } else {
    stage.innerHTML = `<div class="text-center mb-4"><div class="quiz-q num-q">${prob.display}</div></div>
      <div class="num-fields">${shown.map(boxHTML).join('')}</div>`;
  }
  stage.querySelectorAll('[data-b]').forEach(el => el.onclick = () => { if (!waiting) { cur = +el.dataset.b; paint(); } });
  NumPad.setGo(target() === null);
}

/** '다음 칸'을 누르면 갈 곳 — 칸 번호, 'new'(약수 칸 하나 더), null(남은 칸이 없으니 확인) */
function target() {
  const need = b => !isGrow(b) && boxes[b].k !== 'opt' && !boxes[b].v;   // 꼭 채워야 하는 빈 칸
  if (boxes[cur].k === 'opt') {                             // 도움 칸 → 다음 도움 칸 → 답의 첫 빈 자릿수 칸
    if (boxes[cur + 1] && boxes[cur + 1].k === 'opt') return cur + 1;
    const e = firstEmptyDigit(); if (e !== -1) return e;
  }
  if (boxes[cur].k === 'd') {                               // 자릿수 칸은 쓰는 방향으로(B1 왼쪽, 나머지 오른쪽)
    for (let b = cur + dStep(); boxes[b] && boxes[b].k === 'd'; b += dStep()) if (!boxes[b].v) return b;
    const e = firstEmptyDigit(); if (e !== -1) return e;
  }
  for (let b = cur + 1; b < boxes.length; b++) if (need(b)) return b;
  if (isGrow(cur) && boxes[cur].v) {
    const f = boxes[cur].f;
    const empty = boxes.findIndex((x, b) => x.f === f && !x.v);
    return empty !== -1 ? empty : 'new';
  }
  for (let b = 0; b < boxes.length; b++) if (b !== cur && need(b)) return b;
  return null;
}

function press(k) {
  if (waiting) return;
  const fbEl = document.getElementById('numFb');
  if (fbEl && fbEl.querySelector('.text-amber-600')) fbEl.innerHTML = '';   // 안내는 다시 누르면 지운다
  const box = boxes[cur];
  if (k === 'go' || k === 'ok' || k === ',') {
    const t = target();
    if (t === null) return submit();
    if (t === 'new') {
      const add = pairs() ? 2 : 1, at = boxes.reduce((m, x, b) => x.f === box.f ? b : m, cur) + 1;
      for (let i = 0; i < add; i++) boxes.splice(at, 0, { f: box.f, v: '', k: 'n' });
      cur = at;
    }
    else cur = t;
    return paint();
  }
  if (box.k === 'd' && /^\d$/.test(k)) {                  // 자릿수 칸: 한 칸에 숫자 하나, 쓰면 다음 칸으로
    box.v = k;
    if (boxes[cur + dStep()] && boxes[cur + dStep()].k === 'd') cur += dStep();
    return paint();
  }
  if (box.k === 'd' && (k === 'del' || k === '⌫') && !box.v && boxes[cur - dStep()] && boxes[cur - dStep()].k === 'd') {
    cur -= dStep(); boxes[cur].v = ''; return paint();      // 빈 자릿수 칸에서 지우기 = 바로 전에 쓴 칸을 지우고 그리로
  }
  if (k === '.') {                                        // 소수점: 답 칸에 한 번만. 빈 칸이면 '0.'
    if (box.k === 'n' && fieldOf(cur).dec && !box.v.includes('.')) box.v = (box.v || '0') + '.';
    return paint();
  }
  if (k === 'clear') { if (box.k === 'd') boxes.forEach(x => { if (x.k === 'd') x.v = ''; }); else box.v = ''; if (box.k === 'd') cur = firstCur(); }
  else if (k === 'del' || k === '⌫') {
    if (!box.v && isGrow(cur) && !pairs() && boxes.filter(x => x.f === box.f).length > 1) {   // 빈 약수 칸은 없애고 앞 칸으로
      boxes.splice(cur, 1); cur = Math.max(0, cur - 1);
    } else box.v = box.v.slice(0, -1);
  } else if (/^\d$/.test(k)) {
    if (box.v === '0') box.v = k;                          // 0 으로 시작하는 수(05)는 만들지 않는다
    else if (box.v.length < (fieldOf(cur).dec ? 8 : 6)) box.v += k;
    if (isAuto()) { paint(); return submit(); }           // 한 자리 답은 바로 채점
  }
  paint();
}

/** 칸마다 맞았나(ok/no). list 는 순서 상관없이 정답 목록에 있는 수면 ok */
function judge() {
  const ds = boxes.filter(x => x.k === 'd');
  return boxes.map(x => {
    const f = prob.fields[x.f];
    if (!x.v || x.k === 'opt') return '';
    if (x.k === 'd') return String(f.ans)[ds.indexOf(x)] === x.v ? 'ok' : 'no';
    return (f.list ? f.ans.includes(Number(x.v)) : Number(x.v) === f.ans) ? 'ok' : 'no';
  });
}
function fieldOK(fi) {
  const f = prob.fields[fi];
  if (f.vert) return boxes.filter(x => x.k === 'd').map(x => x.v).join('') === String(f.ans);
  let got = boxes.filter(x => x.f === fi && x.v && x.k === 'n').map(x => Number(x.v));
  if (pairs()) got = [...new Set(got)];                      // 짝 줄은 6 × 6 처럼 같은 수가 두 번 나올 수 있다
  if (!f.list) return got.length === 1 && got[0] === f.ans;
  const want = f.ans.slice().sort((a, b) => a - b), g = got.slice().sort((a, b) => a - b);
  return g.length === want.length && g.every((x, i) => x === want[i]);
}
const ansText = f => f.list ? f.ans.join(', ') : String(f.ans);

function submit() {
  // 꼭 채워야 할 칸이 비었으면 그 칸으로 옮기기만 한다 (실수로 확인을 눌러 틀리지 않게)
  const empty = boxes.findIndex((x, b) => !x.v && !isGrow(b) && x.k !== 'opt');
  if (empty !== -1) { cur = empty; paint(); return; }
  const fb = document.getElementById('numFb');
  if (prob.fields.some((f, i) => f.grow && !boxes.some(x => x.f === i && x.v))) {
    fb.innerHTML = '<span class="text-amber-600 text-base">수를 하나 이상 써 주세요.</span>';
    return;
  }
  // 같은 수를 두 번 쓴 것은 입력 실수 — 채점하지 않고 알려 준다(어느 수인지는 학생이 찾는다)
  if (!pairs() && prob.fields.some((f, i) => { const v = boxes.filter(x => x.f === i && x.v).map(x => x.v); return f.list && new Set(v).size !== v.length; })) {
    fb.innerHTML = '<span class="text-amber-600 text-base">같은 수를 두 번 썼어요. 하나를 지워 주세요.</span>';
    return;
  }
  waiting = true;
  marks = judge();
  const ok = prob.fields.every((f, i) => fieldOK(i));
  // 소수 답에 끝자리 0(6.0 · 1.20)이나 끝에 소수점만(6.)을 남겼으면 정답으로 하되 고쳐 쓰는 법을 알려 준다
  const tail = ok && isDec() && boxes.some(x => x.k === 'n' && /\.(\d*0)?$/.test(x.v));
  fb.innerHTML = tail ? `<span class="t-ok">정답입니다! ⭕</span><div class="text-base text-gray-700 mt-1">소수 끝자리 0은 지워서 <b>${ansText(prob.fields[0])}</b>${uro(prob.fields[0].ans)} 써요</div>`
    : ok ? '<span class="t-ok">정답입니다! ⭕</span>'
    : `<span class="t-no">틀렸습니다 ❌</span><div class="text-base text-gray-700 mt-1">정답: ${
        prob.fields.map(f => (f.label ? f.label + ' ' : '') + `<b>${ansText(f)}</b>`).join(' · ')}</div>`;
  paint();
  const done = Session.problemDone(ok);
  setTimeout(() => {
    if (!done) return next();
    document.getElementById('numBody').innerHTML = Session.finishHTML();
    Session.saveResult();
  }, tail ? 1800 : ok ? 700 : 2200);
}

/* 키보드 입력 — 풀이 화면이 보일 때만. 쉼표·스페이스·Enter·Tab 은 '다음 칸' */
document.addEventListener('keydown', e => {
  if (!prob || !document.getElementById('numStage')) return;
  if (/^\d$/.test(e.key)) press(e.key);
  else if (e.key === '.') { e.preventDefault(); press('.'); }
  else if (e.key === ',' || e.key === ' ') { e.preventDefault(); press(','); }
  else if (e.key === 'Backspace') { e.preventDefault(); press('⌫'); }
  else if (e.key === 'Enter') { e.preventDefault(); press('go'); }
  else if (e.key === 'Tab' && boxes.length > 1 && !waiting) { e.preventDefault(); cur = (cur + 1) % boxes.length; paint(); }
});

/** 테스트 전용 — 지금 문제 */
function debugProblem() { return prob; }

return { init, debugProblem };
})();
