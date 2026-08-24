/* quiz.js — 4지선다 엔진 (L3 · L6 · L9 · L12) */
const Quiz = (() => {
const { eqExact, eqValue, fracHTML, fracText } = window.Frac;

let level, cfg, queue, cur, waiting;

function init(lv, mode, config, onExit) {
  level = lv; cfg = config;
  Session.start(lv, mode, config, 'choice', onExit);
  queue = [];
  render();
  Session.startTimer();
  nextQuestion();
}

function render() {
  const area = document.getElementById('practiceArea');
  area.classList.remove('hidden');
  area.innerHTML = `${Session.headerHTML()}
    <div class="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
      <div class="text-center text-xs text-gray-400 font-black mb-4 tracking-widest">${cfg.label}</div>
      <div id="quizBody"></div>
    </div>`;
}

/** 문제를 한 번에 넉넉히 만들어 두고 꺼내 쓴다 */
function refill() { queue = Gen.generateChoiceSet(level, 20); }

function nextQuestion() {
  if (!queue.length) refill();
  cur = queue.shift();
  waiting = false;
  const body = document.getElementById('quizBody');
  body.innerHTML = `
    <div class="text-center mb-6"><div class="quiz-q">${cur.display}<span class="q-op">=</span><span class="text-gray-300">?</span></div></div>
    <div id="quizChoices" class="grid grid-cols-2 gap-3"></div>
    <div id="quizFb" class="min-h-8 mt-4 text-center font-bold text-lg"></div>`;

  const grid = document.getElementById('quizChoices');
  cur.choices.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-choice';
    btn.innerHTML = cur.kind === 'frac' ? fracHTML(c) : `<span class="text-2xl font-black">${c}</span>`;
    btn.onclick = () => pick(i, btn);
    grid.appendChild(btn);
  });
}

function pick(i, btn) {
  if (waiting) return;
  waiting = true;
  const chosen = cur.choices[i];
  const isFrac = cur.kind === 'frac';
  const ok = isFrac ? eqExact(chosen, cur.answer) : chosen === cur.answer;
  const nearMiss = !ok && isFrac && eqValue(chosen, cur.answer);

  document.querySelectorAll('.quiz-choice').forEach(b => b.disabled = true);
  const fb = document.getElementById('quizFb');

  if (ok) {
    btn.classList.add('qc-right');
    fb.innerHTML = '<span class="text-green-600">정답입니다! ⭕</span>';
  } else {
    btn.classList.add('qc-wrong');
    document.querySelectorAll('.quiz-choice').forEach((b, j) => {
      const c = cur.choices[j];
      const hit = isFrac ? eqExact(c, cur.answer) : c === cur.answer;
      if (hit) b.classList.add('qc-answer');
    });
    fb.innerHTML = nearMiss
      ? '<span class="text-amber-600">값은 맞아요! 하지만 <b>기약분수</b>를 골라야 해요 ❌</span>'
      : '<span class="text-red-500">틀렸습니다 ❌</span>';
  }

  const done = Session.problemDone(ok);
  setTimeout(() => {
    if (done) {
      document.getElementById('quizBody').innerHTML = Session.finishHTML();
      Session.saveResult();
    } else nextQuestion();
  }, ok ? 900 : (nearMiss ? 2200 : 1600));
}

return { init };
})();
