/* session.js — 연습/도전 세션 공통 뼈대 (헤더 · 타이머 · 결과 화면 · 점수 저장) */
(() => {
const S = {
  level: null, mode: null, cfg: null, engine: null,
  solved: 0, correct: 0, incorrect: 0,
  total: 0, timeLimit: 0, startAt: 0, timer: null, overtime: false,
  saved: false, onExit: null
};

function start(level, mode, cfg, engine, onExit) {
  S.level = level; S.mode = mode; S.cfg = cfg; S.engine = engine; S.onExit = onExit;
  S.solved = 0; S.correct = 0; S.incorrect = 0; S.overtime = false; S.saved = false;
  S.startAt = Date.now();
  if (mode === 'challenge') { S.total = cfg.chalQ; S.timeLimit = cfg.chalTime; }
  else { S.total = 0; S.timeLimit = 0; }
}

const isChallenge = () => S.mode === 'challenge';
const elapsed = () => Math.floor((Date.now() - S.startAt) / 1000);

/** 화면 상단 헤더 (풀이 수 · 타이머 · 그만하기) */
function headerHTML() {
  const counter = isChallenge() ? `${S.solved} / ${S.total}` : `${S.solved}`;
  const timer = isChallenge()
    ? '<div id="sessTimer" class="font-mono text-lg font-bold text-gray-700">남은 시간: --</div>'
    : '<div class="text-xs font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">🌱 자유 연습</div>';
  return `<div class="flex justify-between items-center gap-2 mb-3">
    <div class="text-sm text-gray-500 font-bold whitespace-nowrap">풀이 <span class="text-indigo-600 text-lg" id="sessSolved">${counter}</span></div>
    ${timer}
    <button class="px-3 py-2 bg-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-300 transition text-sm whitespace-nowrap" onclick="Session.exit()">그만하기</button>
  </div>`;
}

function updateSolved() {
  const el = document.getElementById('sessSolved');
  if (el) el.textContent = isChallenge() ? `${S.solved} / ${S.total}` : `${S.solved}`;
}

function startTimer() {
  stopTimer();
  if (!isChallenge()) return;
  const paint = () => {
    const el = document.getElementById('sessTimer');
    if (!el) return;
    const left = S.timeLimit - elapsed();
    if (left >= 0) {
      el.textContent = `남은 시간: ${left}초`;
      el.classList.remove('text-red-600'); el.classList.add('text-gray-700');
    } else {
      S.overtime = true;
      el.textContent = `초과: ${Math.abs(left)}초`;
      el.classList.remove('text-gray-700'); el.classList.add('text-red-600');
    }
  };
  paint();
  S.timer = setInterval(paint, 1000);
}
function stopTimer() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }

/** 문제 1개 끝. 도전 모드에서 목표 문제 수를 채웠으면 true */
function problemDone(ok) {
  S.solved++;
  if (ok) S.correct++; else S.incorrect++;
  updateSolved();
  return isChallenge() && S.solved >= S.total;
}

/** 도전 완료 화면 HTML */
function finishHTML() {
  stopTimer();
  const dur = elapsed();
  const over = S.overtime || dur > S.timeLimit;
  const badge = over
    ? '<div class="mb-3 inline-flex items-center rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700">시간 초과</div>'
    : '<div class="mb-3 inline-flex items-center rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-700">시간 내 완료!</div>';
  return `<div class="bg-white p-6 rounded-2xl border border-gray-200 text-center">
    <h2 class="text-2xl font-black text-blue-600 mb-2">도전 완료!</h2>
    <p class="text-gray-500 mb-4">${App.studentName} 학생, 수고했어요!</p>
    ${badge}
    <div class="space-y-2 mb-4 text-left max-w-xs mx-auto">
      <div class="flex justify-between p-2 bg-green-50 rounded-lg"><span class="text-green-600 font-bold">정답</span><span class="font-black text-green-700">${S.correct}개</span></div>
      <div class="flex justify-between p-2 bg-red-50 rounded-lg"><span class="text-red-500 font-bold">오답</span><span class="font-black text-red-600">${S.incorrect}개</span></div>
      <div class="flex justify-between p-2 bg-blue-50 rounded-lg"><span class="text-blue-600 font-bold">시간</span><span class="font-black text-blue-700">${Math.floor(dur/60)}분 ${dur%60}초</span></div>
      <div class="flex justify-between p-2 bg-amber-50 rounded-lg"><span class="text-amber-700 font-bold">점수</span><span id="sessScore" class="font-black text-amber-700">계산 중...</span></div>
    </div>
    <div id="sessScoreNote" class="text-sm font-bold text-gray-500 mb-4">점수 계산 중...</div>
    <button onclick="Session.exit()" class="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition">돌아가기</button>
  </div>`;
}

/** 저장용 payload (점수는 db.js 에서 계산) */
function buildPayload() {
  const dur = elapsed();
  const over = isChallenge() && (S.overtime || dur > S.timeLimit);
  return {
    studentNo: App.studentNo,
    level: S.level,
    mode: isChallenge() ? 'challenge' : 'free',
    totalQuestions: S.solved,
    correct: S.correct,
    incorrect: S.incorrect,
    accuracyPct: S.solved ? Math.round((S.correct / S.solved) * 100) : 0,
    durationSec: dur,
    timeLimit: S.timeLimit,
    isOvertime: over,
    resultStatus: !isChallenge() ? 'practice' : (over ? 'failed_overtime' : 'success')
  };
}

/** 도전 완료 시 결과 저장 → 점수 표시 */
function saveResult() {
  S.saved = true;
  DB.saveResult(buildPayload())
    .then(showScore)
    .catch(() => showScore({ displayScore: null, scoreRecorded: false, message: '점수 저장에 실패했습니다.', isError: true }));
}

function showScore(r) {
  const v = document.getElementById('sessScore'), n = document.getElementById('sessScoreNote');
  if (!v || !n) return;
  v.textContent = r && r.displayScore != null ? `${r.displayScore}점` : '기록 없음';
  n.textContent = r ? (r.message || '') : '저장 실패';
  n.className = r && r.isError ? 'text-sm font-bold text-red-500'
              : r && r.scoreRecorded ? 'text-sm font-bold text-green-600'
              : 'text-sm font-bold text-gray-500';
}

function exit() {
  stopTimer();
  // 자유 연습도 '푼 기록'은 남긴다 (점수는 null 이라 랭킹·해금에 영향 없음)
  if (!S.saved && S.solved > 0) { S.saved = true; DB.saveResult(buildPayload()).catch(() => {}); }
  const area = document.getElementById('practiceArea');
  area.classList.add('hidden'); area.innerHTML = '';
  if (S.onExit) S.onExit();
}

window.Session = {
  state: S, start, isChallenge, elapsed,
  headerHTML, updateSolved, startTimer, stopTimer,
  problemDone, finishHTML, saveResult, exit
};
})();
