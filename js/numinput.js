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
 * 계산은 학생이 한다. 화면은 칸 옮기기·지우기만 돕는다.
 * 4지선다와 달리 찍을 수 없으므로 오답 시간 페널티는 두지 않는다.
 */
const NumInput = (() => {
let level, cfg, prob, boxes, cur, waiting, marks;

function init(lv, mode, config, onExit) {
  level = lv; cfg = config;
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

/* 칸 목록 — { f: 몇 번째 field, v: 쓴 수(문자열) } */
function makeBoxes() {
  const out = [];
  prob.fields.forEach((f, i) => {
    const n = f.list && !f.grow ? f.ans.length : 1;
    for (let k = 0; k < n; k++) out.push({ f: i, v: '' });
  });
  return out;
}
const fieldOf = b => prob.fields[boxes[b].f];
const isGrow = b => !!fieldOf(b).grow;
const isQR = () => prob.fields.length === 2 && prob.fields[0].label === '몫';
const isAuto = () => prob.fields.length === 1 && !!prob.fields[0].auto;

function next() {
  prob = Gen.generateNumProblem(level);
  boxes = makeBoxes();
  cur = 0; waiting = false; marks = null;
  Scratch.clear();
  document.getElementById('numBody').innerHTML = `
    <div id="numStage"></div>
    <div id="numFb" class="min-h-8 mt-2 text-center font-bold text-lg"></div>
    ${NumPad.html(isAuto() ? { noGo: true } : {})}`;
  NumPad.bind(document.getElementById('numBody'), press);
  paint();
}

function boxHTML(b) {
  const f = fieldOf(b), cls = ['num-field'];
  if (f.list) cls.push('num-item');
  if (b === cur && !waiting) cls.push('on');
  if (marks) cls.push(marks[b]);
  const lbl = f.label ? `<span class="num-lbl">${f.label}</span>` : '';
  return `<button type="button" class="${cls.join(' ')}" data-b="${b}">${lbl}<span class="num-val">${boxes[b].v}</span></button>`;
}

function paint() {
  const stage = document.getElementById('numStage');
  if (!stage) return;
  const shown = boxes.map((x, b) => b).filter(b => !(marks && isGrow(b) && !boxes[b].v));   // 채점 뒤에는 남은 빈 칸을 숨긴다
  if (isQR()) {
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
  const need = b => !isGrow(b) && !boxes[b].v;              // 꼭 채워야 하는 빈 칸
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
    if (t === 'new') { boxes.splice(cur + 1, 0, { f: box.f, v: '' }); cur++; }
    else cur = t;
    return paint();
  }
  if (k === 'clear') box.v = '';
  else if (k === 'del' || k === '⌫') {
    if (!box.v && isGrow(cur) && boxes.filter(x => x.f === box.f).length > 1) {   // 빈 약수 칸은 없애고 앞 칸으로
      boxes.splice(cur, 1); cur = Math.max(0, cur - 1);
    } else box.v = box.v.slice(0, -1);
  } else if (/^\d$/.test(k)) {
    if (box.v === '0') box.v = k;                          // 0 으로 시작하는 수(05)는 만들지 않는다
    else if (box.v.length < 6) box.v += k;
    if (isAuto()) { paint(); return submit(); }           // 한 자리 답은 바로 채점
  }
  paint();
}

/** 칸마다 맞았나(ok/no). list 는 순서 상관없이 정답 목록에 있는 수면 ok */
function judge() {
  return boxes.map(x => {
    const f = prob.fields[x.f];
    if (!x.v) return '';
    return (f.list ? f.ans.includes(Number(x.v)) : Number(x.v) === f.ans) ? 'ok' : 'no';
  });
}
function fieldOK(fi) {
  const f = prob.fields[fi], got = boxes.filter(x => x.f === fi && x.v).map(x => Number(x.v));
  if (!f.list) return got.length === 1 && got[0] === f.ans;
  const want = f.ans.slice().sort((a, b) => a - b), g = got.slice().sort((a, b) => a - b);
  return g.length === want.length && g.every((x, i) => x === want[i]);
}
const ansText = f => f.list ? f.ans.join(', ') : String(f.ans);

function submit() {
  // 꼭 채워야 할 칸이 비었으면 그 칸으로 옮기기만 한다 (실수로 확인을 눌러 틀리지 않게)
  const empty = boxes.findIndex((x, b) => !x.v && !isGrow(b));
  if (empty !== -1) { cur = empty; paint(); return; }
  const fb = document.getElementById('numFb');
  if (prob.fields.some((f, i) => f.grow && !boxes.some(x => x.f === i && x.v))) {
    fb.innerHTML = '<span class="text-amber-600 text-base">수를 하나 이상 써 주세요.</span>';
    return;
  }
  // 같은 수를 두 번 쓴 것은 입력 실수 — 채점하지 않고 알려 준다(어느 수인지는 학생이 찾는다)
  if (prob.fields.some((f, i) => { const v = boxes.filter(x => x.f === i && x.v).map(x => x.v); return f.list && new Set(v).size !== v.length; })) {
    fb.innerHTML = '<span class="text-amber-600 text-base">같은 수를 두 번 썼어요. 하나를 지워 주세요.</span>';
    return;
  }
  waiting = true;
  marks = judge();
  const ok = prob.fields.every((f, i) => fieldOK(i));
  fb.innerHTML = ok ? '<span class="t-ok">정답입니다! ⭕</span>'
    : `<span class="t-no">틀렸습니다 ❌</span><div class="text-base text-gray-700 mt-1">정답: ${
        prob.fields.map(f => (f.label ? f.label + ' ' : '') + `<b>${ansText(f)}</b>`).join(' · ')}</div>`;
  paint();
  const done = Session.problemDone(ok);
  setTimeout(() => {
    if (!done) return next();
    document.getElementById('numBody').innerHTML = Session.finishHTML();
    Session.saveResult();
  }, ok ? 700 : 2200);
}

/* 키보드 입력 — 풀이 화면이 보일 때만. 쉼표·스페이스·Enter·Tab 은 '다음 칸' */
document.addEventListener('keydown', e => {
  if (!prob || !document.getElementById('numStage')) return;
  if (/^\d$/.test(e.key)) press(e.key);
  else if (e.key === ',' || e.key === ' ') { e.preventDefault(); press(','); }
  else if (e.key === 'Backspace') { e.preventDefault(); press('⌫'); }
  else if (e.key === 'Enter') { e.preventDefault(); press('go'); }
  else if (e.key === 'Tab' && boxes.length > 1 && !waiting) { e.preventDefault(); cur = (cur + 1) % boxes.length; paint(); }
});

/** 테스트 전용 — 지금 문제 */
function debugProblem() { return prob; }

return { init, debugProblem };
})();
