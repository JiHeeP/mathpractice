/* quiz.js — 4지선다 엔진
 * 문제는 generator.js 가 만든 { display, choices:[{html, correct, near}] } 를 그대로 표시한다.
 * 도전 모드에서 오답을 고르면 시간 페널티 +10초 (찍기 방지).
 */
const Quiz = (() => {
const WRONG_TIME_PENALTY = 10;                        // 초

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
  area.innerHTML = `${Session.headerHTML()}${Scratch.wrap(cfg, `
    <div class="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
      <div class="text-center text-xs text-gray-400 font-black mb-4 tracking-widest">${cfg.label}</div>
      <div id="quizBody"></div>
    </div>`)}`;
  Scratch.mount();   // 종이 계산이 필요한 레벨(cfg.scratch)만 계산 연습장이 붙는다
}

function refill() { queue = Gen.generateChoiceSet(level, 20); }

function nextQuestion() {
  if (!queue.length) refill();
  cur = queue.shift();
  waiting = false;
  Scratch.clear();
  document.getElementById('quizBody').innerHTML = `
    <div class="text-center mb-6"><div class="quiz-q">${cur.display}</div></div>
    <div id="quizChoices" class="grid grid-cols-2 gap-3"></div>
    <div id="quizFb" class="min-h-8 mt-4 text-center font-bold text-lg"></div>`;
  const grid = document.getElementById('quizChoices');
  cur.choices.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-choice';
    btn.innerHTML = c.html;
    btn.onclick = () => pick(i, btn);
    grid.appendChild(btn);
  });
}

function pick(i, btn) {
  if (waiting) return;
  waiting = true;
  const chosen = cur.choices[i];
  const ok = chosen.correct;

  document.querySelectorAll('.quiz-choice').forEach(b => b.disabled = true);
  const fb = document.getElementById('quizFb');

  if (ok) {
    btn.classList.add('qc-right');
    fb.innerHTML = '<span class="t-ok">정답입니다! ⭕</span>';
  } else {
    btn.classList.add('qc-wrong');
    document.querySelectorAll('.quiz-choice').forEach((b, j) => {
      if (cur.choices[j].correct) b.classList.add('qc-answer');
    });
    let msg = chosen.near
      ? `<span class="text-amber-600">${chosen.near} ❌</span>`
      : '<span class="t-no">틀렸습니다 ❌</span>';
    if (Session.isChallenge()) {
      Session.penalize(WRONG_TIME_PENALTY);
      msg += `<div class="text-xs t-no mt-1">⏱ 시간 −${WRONG_TIME_PENALTY}초</div>`;
    }
    fb.innerHTML = msg;
  }

  const done = Session.problemDone(ok);
  setTimeout(() => {
    if (done) {
      document.getElementById('quizBody').innerHTML = Session.finishHTML();
      Session.saveResult();
    } else nextQuestion();
  }, ok ? 700 : (chosen.near ? 1800 : 1300));
}

/* 키보드 1~4 — 보기 순서대로(왼쪽 위 1, 오른쪽 위 2, 왼쪽 아래 3, 오른쪽 아래 4). 풀이 화면이 보일 때만 */
document.addEventListener('keydown', e => {
  if (waiting || !cur || !document.getElementById('quizChoices')) return;
  const i = '1234'.indexOf(e.key);
  if (i === -1 || e.target.closest && e.target.closest('input, textarea')) return;
  const btn = document.querySelectorAll('.quiz-choice')[i];
  if (btn) { e.preventDefault(); pick(i, btn); }
});

/** 테스트 전용 — 현재 문제의 정답 보기 인덱스 */
function debugCorrectIndex() { return cur ? cur.choices.findIndex(c => c.correct) : -1; }

return { init, debugCorrectIndex };
})();
