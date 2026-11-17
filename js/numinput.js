/* numinput.js — 숫자 직접 입력 엔진 (기초 연산 B1~B10)
 * 문제는 generator.js 의 generateNumProblem 이 만든 { display, fields:[{label, ans, list?}] }.
 * 화면 숫자판(js/numpad.js — 0~9 · 지우기 · 쉼표 · 다음 칸/확인)으로 칸을 채운다. 키보드로 쳐도 된다.
 *   - 칸이 여러 개면(몫·나머지) 칸을 눌러 옮기거나 '다음 칸 ▶'(키보드 Enter)으로 넘어간다. 마지막 칸에서는 '확인'
 *   - list 칸(약수·배수)은 쉼표로 구분해 여러 수를 쓴다. 순서는 상관없다
 * 4지선다와 달리 찍을 수 없으므로 오답 시간 페널티는 두지 않는다.
 */
const NumInput = (() => {
let level, cfg, prob, vals, cur, waiting;

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


function next() {
  prob = Gen.generateNumProblem(level);
  vals = prob.fields.map(() => '');
  cur = 0; waiting = false;
  Scratch.clear();
  const hasList = prob.fields.some(f => f.list);
  document.getElementById('numBody').innerHTML = `
    <div class="text-center mb-4"><div class="quiz-q num-q">${prob.display}</div></div>
    <div class="num-fields">${prob.fields.map((f, i) => `
      <button class="num-field" data-i="${i}">${f.label ? `<span class="num-lbl">${f.label}</span>` : ''}<span class="num-val" id="numVal${i}"></span></button>`).join('')}
    </div>
    ${hasList ? '<div class="text-center text-xs font-bold text-gray-400 mt-1">수와 수 사이에 쉼표( , )를 넣어요</div>' : ''}
    <div id="numFb" class="min-h-8 mt-2 text-center font-bold text-lg"></div>
    ${NumPad.html(hasList ? { extra: ',', extraLabel: '쉼표<br><b class="text-2xl">,</b>' } : {})}
`;
  document.querySelectorAll('.num-field').forEach(b => b.onclick = () => { if (!waiting) { cur = +b.dataset.i; paint(); } });
  NumPad.bind(document.getElementById('numBody'), press);
  paint();
}

/** 지금 칸 말고 빈칸이 남았으면 '다음 칸 ▶', 아니면 '확인' */
const isLast = () => !vals.some((v, i) => i !== cur && v.trim() === '');

function paint() {
  prob.fields.forEach((f, i) => {
    const el = document.getElementById('numVal' + i);
    if (el) el.textContent = vals[i];
    const box = el && el.parentElement;
    if (box) box.classList.toggle('on', i === cur && !waiting);
  });
  NumPad.setGo(isLast());
}

function press(k) {
  if (waiting) return;
  const f = prob.fields[cur];
  const fbEl = document.getElementById('numFb');
  if (fbEl && fbEl.querySelector('.text-amber-600')) fbEl.innerHTML = '';   // 안내는 다시 누르면 지운다
  if (k === 'go' || k === 'ok') {
    if (isLast()) return submit();
    const empty = vals.findIndex((v, i) => i > cur && v.trim() === '');
    cur = empty !== -1 ? empty : vals.findIndex(v => v.trim() === '');
    return paint();
  }
  if (k === 'clear') vals[cur] = '';
  else if (k === 'del' || k === '⌫') vals[cur] = /, $/.test(vals[cur]) ? vals[cur].slice(0, -2) : vals[cur].slice(0, -1);
  else if (k === ',') { if (f.list && vals[cur] && !/, $/.test(vals[cur])) vals[cur] += ', '; }
  else if (/^\d$/.test(k)) {
    const tail = vals[cur].split(',').pop().trim();
    if (tail.length < 6 && tail !== '0') vals[cur] += k;   // 0 으로 시작하는 수(05)는 막는다
  }
  paint();
}

const nums = v => v.split(',').map(x => x.trim()).filter(Boolean).map(Number);

function fieldOK(f, v) {
  if (!f.list) return v !== '' && Number(v) === f.ans;
  const got = nums(v).sort((a, b) => a - b), want = f.ans.slice().sort((a, b) => a - b);
  return got.length === want.length && got.every((x, i) => x === want[i]);
}
const ansText = f => f.list ? f.ans.join(', ') : String(f.ans);

function submit() {
  // 빈 칸이 있으면 그 칸으로 옮기기만 한다 (실수로 확인을 눌러 틀리지 않게)
  const empty = vals.findIndex(v => v.trim() === '');
  if (empty !== -1) { cur = empty; paint(); return; }
  // 같은 수를 두 번 쓴 것은 입력 실수 — 채점하지 않고 알려 준다(어느 수인지는 학생이 찾는다)
  if (prob.fields.some((f, i) => f.list && new Set(nums(vals[i])).size !== nums(vals[i]).length)) {
    document.getElementById('numFb').innerHTML = '<span class="text-amber-600 text-base">같은 수를 두 번 썼어요. 하나를 지워 주세요.</span>';
    return;
  }
  waiting = true;
  const results = prob.fields.map((f, i) => fieldOK(f, vals[i]));
  const ok = results.every(Boolean);
  prob.fields.forEach((f, i) => {
    const box = document.getElementById('numVal' + i).parentElement;
    box.classList.add(results[i] ? 'ok' : 'no');
  });
  const fb = document.getElementById('numFb');
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

/* 키보드 입력 — 풀이 화면이 보일 때만 */
document.addEventListener('keydown', e => {
  if (!prob || !document.getElementById('numBody')) return;
  if (/^\d$/.test(e.key)) press(e.key);
  else if (e.key === ',' || e.key === ' ') { e.preventDefault(); press(','); }   // 스페이스도 쉼표로
  else if (e.key === 'Backspace') { e.preventDefault(); press('⌫'); }
  else if (e.key === 'Enter') { e.preventDefault(); press('go'); }
  else if (e.key === 'Tab' && prob.fields.length > 1 && !waiting) { e.preventDefault(); cur = (cur + 1) % prob.fields.length; paint(); }
});

/** 테스트 전용 — 지금 문제 */
function debugProblem() { return prob; }

return { init, debugProblem };
})();
