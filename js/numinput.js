/* numinput.js — 숫자 직접 입력 엔진 (기초 연산 B1~B10)
 * 문제는 generator.js 의 generateNumProblem 이 만든 { display, fields:[{label, ans, list?}] }.
 * 화면 숫자판(0~9 · 지우기 · 쉼표)으로 칸을 채운다. 키보드로 쳐도 된다.
 *   - 칸이 여러 개면(몫·나머지) 칸을 눌러 옮기거나, 칸이 차면 '다음 칸'으로 넘어간다
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
  area.innerHTML = `${Session.headerHTML()}
    <div class="num-layout">
      <div class="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
        <div class="text-center text-xs text-gray-400 font-black mb-4 tracking-widest">${cfg.label}</div>
        <div id="numBody"></div>
      </div>
      <div class="scratch">
        <div class="scratch-head"><span>✏️ 계산 연습장</span><button id="scratchClear" class="scratch-clear">지우기</button></div>
        <canvas id="scratchCanvas"></canvas>
      </div>
    </div>`;
  setWide(true);
  Scratch.attach(document.getElementById('scratchCanvas'));
  document.getElementById('scratchClear').onclick = () => Scratch.clear();
  Session.startTimer();
  next();
}

/** 연습장을 옆에 두려고 넓은 화면에서는 앱 틀을 넓힌다. 풀이 화면을 떠나면 원래대로 */
function setWide(on) { document.body.classList.toggle('num-wide', on); }
new MutationObserver(() => {
  const area = document.getElementById('practiceArea');
  if (area && (area.classList.contains('hidden') || !document.getElementById('scratchCanvas'))) setWide(false);
}).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });

/* ═══ 계산 연습장 — 손가락·펜으로 쓰는 그림판. 저장·전송하지 않는다(기록 아님). 문제가 바뀌면 지운다 ═══ */
const Scratch = (() => {
  let cv, ctx, drawing = false, last = null;
  function fit() {
    if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!r.width) return;
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (cv.width === w && cv.height === h) return;
    const keep = cv.width ? ctx.getImageData(0, 0, cv.width, cv.height) : null;
    cv.width = w; cv.height = h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#1f2937';
    if (keep) ctx.putImageData(keep, 0, 0);
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function down(e) { fit(); drawing = true; last = pos(e); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); dot(last); e.preventDefault(); }
  function move(e) {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p; e.preventDefault();
  }
  function up() { drawing = false; last = null; }
  function dot(p) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#1f2937'; ctx.fill(); }
  function attach(el) {
    cv = el; ctx = cv.getContext('2d'); cv.width = 0;
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => cv.addEventListener(t, up));
    requestAnimationFrame(fit);
  }
  function clear() { if (!cv || !ctx) return; fit(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore(); }
  window.addEventListener('resize', fit);
  return { attach, clear };
})();

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
    <div class="num-pad">${['1','2','3','4','5','6','7','8','9', hasList ? ',' : '', '0', '⌫'].map(k =>
      k ? `<button class="num-key${k === '⌫' ? ' num-del' : ''}" data-k="${k}">${k}</button>` : '<span></span>').join('')}
      <button class="num-key num-ok" data-k="ok">확인</button>
    </div>`;
  document.querySelectorAll('.num-field').forEach(b => b.onclick = () => { if (!waiting) { cur = +b.dataset.i; paint(); } });
  document.querySelectorAll('.num-key').forEach(b => b.onclick = () => press(b.dataset.k));
  paint();
}

function paint() {
  prob.fields.forEach((f, i) => {
    const el = document.getElementById('numVal' + i);
    if (el) el.textContent = vals[i];
    const box = el && el.parentElement;
    if (box) box.classList.toggle('on', i === cur && !waiting);
  });
}

function press(k) {
  if (waiting) return;
  const f = prob.fields[cur];
  if (k === 'ok') return submit();
  if (k === '⌫') vals[cur] = /, $/.test(vals[cur]) ? vals[cur].slice(0, -2) : vals[cur].slice(0, -1);
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
  waiting = true;
  const results = prob.fields.map((f, i) => fieldOK(f, vals[i]));
  const ok = results.every(Boolean);
  prob.fields.forEach((f, i) => {
    const box = document.getElementById('numVal' + i).parentElement;
    box.classList.add(results[i] ? 'ok' : 'no');
  });
  const fb = document.getElementById('numFb');
  fb.innerHTML = ok ? '<span class="text-green-600">정답입니다! ⭕</span>'
    : `<span class="text-red-500">틀렸습니다 ❌</span><div class="text-base text-gray-700 mt-1">정답: ${
        prob.fields.map(f => (f.label ? f.label + ' ' : '') + `<b>${ansText(f)}</b>`).join(' · ')}</div>`;
  paint();
  const done = Session.problemDone(ok);
  setTimeout(() => {
    if (!done) return next();
    document.getElementById('numBody').innerHTML = Session.isSkipTest() ? Session.skipFinishHTML() : Session.finishHTML();
    Session.saveResult();   // 건너뛰기 시험도 기록은 남긴다(점수 없음). 통과 판정은 levels.js computeProgress
  }, ok ? 700 : 2200);
}

/* 키보드 입력 — 풀이 화면이 보일 때만 */
document.addEventListener('keydown', e => {
  if (!prob || !document.getElementById('numBody')) return;
  if (/^\d$/.test(e.key)) press(e.key);
  else if (e.key === ',' ) press(',');
  else if (e.key === 'Backspace') { e.preventDefault(); press('⌫'); }
  else if (e.key === 'Enter') press('ok');
  else if (e.key === 'Tab' && prob.fields.length > 1 && !waiting) { e.preventDefault(); cur = (cur + 1) % prob.fields.length; paint(); }
});

/** 테스트 전용 — 지금 문제 */
function debugProblem() { return prob; }

return { init, debugProblem };
})();
