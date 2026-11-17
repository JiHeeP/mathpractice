/* session.js — 연습/도전 세션 공통 뼈대 (헤더 · 타이머 · 결과 화면 · 점수 저장) */
(() => {
const S = {
  level: null, mode: null, cfg: null, engine: null,
  solved: 0, correct: 0, incorrect: 0,
  total: 0, timeLimit: 0, startAt: 0, timer: null, overtime: false,
  saved: false, onExit: null,
  seq: '',            // 이번 도전에서 푼 문제의 정오 ('1101…') — 통과 판정(최근 문제 창)에 쓴다
  recent: [],         // 이 레벨에서 가장 최근에 푼 문제들의 정오 (이전 도전 포함)
  wasPassed: false,   // 시작할 때 이미 통과한 레벨인가
  justPassed: false   // 이번 도전 중에 통과했는가
};

function start(level, mode, cfg, engine, onExit) {
  S.level = level; S.mode = mode; S.cfg = cfg; S.engine = engine; S.onExit = onExit;
  S.solved = 0; S.correct = 0; S.incorrect = 0; S.overtime = false; S.saved = false;
  S.seq = ''; S.justPassed = false;
  S.recent = mode === 'challenge' ? App.recentOf(level).slice() : [];
  S.wasPassed = App.isPassed(level);
  guardNavigation();
  S.startAt = Date.now();
  if (mode === 'challenge') { S.total = cfg.chalQ; S.timeLimit = cfg.chalTime; }
  else if (mode === 'skiptest') { S.total = Levels.SKIP_TEST_Q; S.timeLimit = 0; }
  else { S.total = 0; S.timeLimit = 0; }
}

const isChallenge = () => S.mode === 'challenge';
/** 기초 레벨의 '5문제 다 맞으면 건너뛰기' — 시간 제한·점수 없음, 하나라도 틀리면 바로 끝 */
const isSkipTest = () => S.mode === 'skiptest';
const elapsed = () => Math.floor((Date.now() - S.startAt) / 1000);

/** 화면 상단 — 진행 막대(몇 번째 문제) · 시간 막대 · 그만하기(✕). 글자 대신 막대로 보여 준다 */
function headerHTML() {
  const x = '<button class="sx-x" onclick="Session.exit()" title="그만하기" aria-label="그만하기">✕</button>';
  if (isSkipTest()) {
    return `<div class="sx-top"><span class="sx-num" id="sessSolved">${S.solved} / ${S.total}</span>
      <div class="sx-bar"><b id="sessProg" style="width:${pct(S.solved, S.total)}%"></b></div>${x}</div>
      <div class="mb-3 text-center text-sm font-black text-slate-600">⏭ 건너뛰기 시험 — ${S.total}문제를 다 맞히면 통과</div>`;
  }
  if (!isChallenge()) {
    return `<div class="sx-top"><span class="sx-num" id="sessSolved">${S.solved}문제</span>
      <span class="sx-free">🌱 연습 · 점수 없음</span><span class="flex-1"></span>${x}</div>`;
  }
  return `<div class="sx-top"><span class="sx-num" id="sessSolved">${S.solved} / ${S.total}</span>
      <div class="sx-bar"><b id="sessProg" style="width:${pct(S.solved, S.total)}%"></b></div>${x}</div>
    <div class="sx-clock" id="sessClock">⏱<div class="sx-bar"><b id="sessClockBar" style="width:100%"></b></div><span id="sessTimer">--</span></div>
    <div id="sessWindow" class="mb-3">${windowHTML(S.level, S.recent, S.wasPassed || S.justPassed)}</div>`;
}
const pct = (a, b) => b ? Math.min(100, Math.round(a / b * 100)) : 0;
const mmss = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** '최근 문제' 막대 — 맞힌 문제는 초록, 틀린 문제는 빨강, 아직 안 푼 칸은 회색.
 *  그만두고 다시 시작해도 이 막대는 그대로 이어진다. */
function windowHTML(level, recent, passed) {
  const w = Levels.passWindow(level);
  const list = (recent || []).slice(-w.size);
  let dots = '';
  for (let i = 0; i < w.size; i++) {
    const v = list[i];
    dots += `<span class="pw-dot ${v === undefined ? '' : v ? 'pw-ok' : 'pw-no'}"></span>`;
  }
  const n = Levels.windowCorrect(list);
  const text = passed
    ? '✅ 통과한 레벨이에요'
    : `최근 ${w.size}문제 중 <b>${n}개</b> 정답 · ${w.need}개면 통과`;
  return `<div class="pw-wrap"><div class="pw-dots">${dots}</div><div class="pw-text">${text}</div></div>`;
}

function updateWindow() {
  const el = document.getElementById('sessWindow');
  if (el) el.innerHTML = windowHTML(S.level, S.recent, S.wasPassed || S.justPassed);
}

function updateSolved() {
  const el = document.getElementById('sessSolved');
  if (el) el.textContent = (isChallenge() || isSkipTest()) ? `${S.solved} / ${S.total}` : `${S.solved}문제`;
  const bar = document.getElementById('sessProg');
  if (bar) bar.style.width = pct(S.solved, S.total) + '%';
}

function startTimer() {
  stopTimer();
  if (!isChallenge()) return;
  const paint = () => {
    const el = document.getElementById('sessTimer');
    if (!el) return;
    const clock = document.getElementById('sessClock'), bar = document.getElementById('sessClockBar');
    const left = S.timeLimit - elapsed();
    if (left >= 0) {
      el.textContent = mmss(left);
      if (bar) bar.style.width = pct(left, S.timeLimit) + '%';
      if (clock) clock.classList.remove('over');
    } else {
      S.overtime = true;
      el.textContent = '+' + mmss(-left);
      if (bar) bar.style.width = '100%';
      if (clock) clock.classList.add('over');
    }
  };
  paint();
  S.timer = setInterval(paint, 1000);
}
function stopTimer() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }

/** 시간 페널티 — 시작 시각을 앞당겨 경과시간에 가산한다 (도전 모드 전용) */
function penalize(sec) {
  if (!isChallenge()) return;
  S.startAt -= sec * 1000;
  const el = document.getElementById('sessClock');
  if (el) {
    el.classList.add('over');
    setTimeout(() => { if (S.timeLimit - elapsed() >= 0) el.classList.remove('over'); }, 900);
  }
}

/** 문제 1개 끝. 도전 모드에서 목표 문제 수를 채웠으면 true */
function problemDone(ok) {
  S.solved++;
  if (ok) S.correct++; else S.incorrect++;
  if (isChallenge()) {
    S.seq += ok ? '1' : '0';
    S.recent.push(ok ? 1 : 0);
    const size = Levels.passWindow(S.level).size;
    if (S.recent.length > size) S.recent.shift();
    if (!S.wasPassed && !S.justPassed && Levels.windowPassed(S.level, S.recent)) S.justPassed = true;
    updateWindow();
  }
  if (isSkipTest()) S.seq += ok ? '1' : '0';
  updateSolved();
  const done = (isChallenge() && S.solved >= S.total) || (isSkipTest() && (!ok || S.solved >= S.total));
  // 풀던 중 탭이 닫히거나 새로고침돼도 여기까지 푼 기록이 남도록 기기에 적어 둔다 (끝나면 saveResult/exit 가 지운다)
  if (!done && !S.saved) DB.saveDraft(App.classCode, buildPayload());
  return done;
}

/** 도전 완료 화면 — 통과했으면 '다음 레벨로'가 큰 버튼, 아니면 '한 번 더'가 큰 버튼 */
function finishHTML() {
  stopTimer();
  const dur = elapsed();
  const over = S.overtime || dur > S.timeLimit;
  const next = App.levelAfter(S.level);
  const head = S.justPassed ? '<div class="res-big text-green-600">통과! 🎉</div>'
             : S.wasPassed ? '<div class="res-big text-indigo-600">잘했어요!</div>'
             : '<div class="res-big text-indigo-600">다 풀었어요!</div>';
  const openLv = S.cfg && S.cfg.open;   // 기초 트랙은 원래 열려 있으므로 '열렸어요' 대신 다음 레벨만 알려 준다
  const passNote = S.justPassed && next
    ? `<div class="mb-3 rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-sm font-black text-green-700">${openLv ? `다음은 ${next}` : `${next} 도전이 열렸어요`}</div>` : '';
  const buttons = S.justPassed && next
    ? `<button onclick="Session.exit('next')" class="big-btn big-go">${next}로 가기 👉</button>
       <button onclick="Session.exit('again')" class="big-btn big-alt">한 번 더</button>`
    : `<button onclick="Session.exit('again')" class="big-btn big-go">🔥 한 번 더</button>`;
  return `<div class="bg-white p-6 rounded-2xl border border-gray-200 text-center">
    ${head}
    <div class="res-row"><span class="text-green-600">⭕ ${S.correct}</span><span class="text-red-500">❌ ${S.incorrect}</span><span class="${over ? 'text-orange-600' : 'text-indigo-600'}">⏱ ${mmss(dur)}</span></div>
    ${over ? '<div class="mb-3 text-sm font-bold text-orange-600">시간이 지났어요</div>' : ''}
    ${passNote}
    <div class="mb-4 text-sm text-gray-500">점수 <b id="sessScore" class="text-amber-700">계산 중...</b> · <span id="sessScoreNote">저장 중...</span></div>
    <div class="flex flex-col gap-3">${buttons}
      <button onclick="Session.exit()" class="text-sm font-bold text-gray-500 underline mt-1">목록으로</button></div>
  </div>`;
}

/** 건너뛰기 시험 결과 화면 */
function skipFinishHTML() {
  const ok = S.seq === '1'.repeat(S.total);
  const next = App.levelAfter(S.level);
  const buttons = ok
    ? (next ? `<button onclick="Session.exit('next')" class="big-btn big-go">${next}로 가기 👉</button>` : '')
    : `<button onclick="Session.exit('challenge')" class="big-btn big-go">🔥 ${S.level} 도전하기</button>`;
  return `<div class="bg-white p-6 rounded-2xl border border-gray-200 text-center">
    ${ok ? `<div class="res-big text-green-600">${S.level} 통과! ⏭</div><div class="mb-4 text-sm font-bold text-gray-500">이 레벨은 건너뛰어도 돼요</div>`
         : `<div class="res-big text-indigo-600">이 레벨부터 연습해요</div><div class="mb-4 text-sm font-bold text-gray-500">${S.correct}문제 맞히고 하나 틀렸어요</div>`}
    <div class="flex flex-col gap-3">${buttons}
      <button onclick="Session.exit()" class="text-sm font-bold text-gray-500 underline mt-1">목록으로</button></div>
  </div>`;
}

/** 저장용 payload (점수는 db.js 에서 계산) */
function buildPayload() {
  const dur = elapsed();
  const over = isChallenge() && (S.overtime || dur > S.timeLimit);
  const seq = (isChallenge() || isSkipTest()) && S.seq ? { seq: S.seq } : {};
  if (isSkipTest()) {
    return Object.assign(seq, {
      studentNo: App.studentNo, level: S.level, mode: 'skiptest',
      totalQuestions: S.solved, correct: S.correct, incorrect: S.incorrect,
      accuracyPct: S.solved ? Math.round((S.correct / S.solved) * 100) : 0,
      durationSec: dur, timeLimit: 0, isOvertime: false, resultStatus: 'skiptest'
    });
  }
  return Object.assign(seq, {
    studentNo: App.studentNo,
    level: S.level,
    mode: !isChallenge() ? 'free' : (S.solved >= S.total ? 'challenge' : 'aborted'),
    totalQuestions: S.solved,
    correct: S.correct,
    incorrect: S.incorrect,
    accuracyPct: S.solved ? Math.round((S.correct / S.solved) * 100) : 0,
    durationSec: dur,
    timeLimit: S.timeLimit,
    isOvertime: over,
    resultStatus: !isChallenge() ? 'practice'
                : S.solved < S.total ? 'aborted'
                : (over ? 'failed_overtime' : 'success')
  });
}

/** 도전 완료 시 결과 저장 → 점수 표시 */
function saveResult() {
  S.saved = true;
  DB.clearDraft();
  DB.saveResult(App.classCode, buildPayload())
    .then(showScore)
    .catch(() => showScore({ displayScore: null, scoreRecorded: false, message: '점수 저장에 실패했습니다.', isError: true }));
}

function showScore(r) {
  const v = document.getElementById('sessScore'), n = document.getElementById('sessScoreNote');
  if (!v || !n) return;
  v.textContent = r && r.displayScore != null ? `${r.displayScore}점` : '기록 없음';
  n.textContent = r ? (r.message || '') : '저장 실패';
  n.className = r && r.isError ? 'font-bold text-red-500'
              : r && r.pending ? 'font-bold text-amber-600'
              : r && r.scoreRecorded ? 'font-bold text-green-600'
              : 'text-gray-500';
}

/* ── 풀던 중 '뒤로 가기'·창 닫기 막기 ──
 * 태블릿의 뒤로 가기(스와이프)나 브라우저 뒤로 가기를 누르면 예전에는 앱을 그냥 떠나 버려서
 * 풀던 기록이 0건으로 사라졌다. 이제 연습을 시작할 때 기록 한 칸을 쌓아 두고,
 * 뒤로 가기를 누르면 페이지를 떠나는 대신 '그만하기'와 똑같이 처리한다(푼 만큼 저장 → 레벨 화면).
 * 창을 닫거나 새로고침하려 하면 브라우저가 한 번 더 묻는다(지원하는 브라우저에서만).
 */
let guarded = false, leavingByBack = false;
function guardNavigation() {
  if (!guarded) {
    try { history.pushState({ mpSession: true }, ''); guarded = true; } catch (e) {}
  }
}
window.addEventListener('popstate', () => {
  if (!guarded) return;
  guarded = false;                 // 쌓아 둔 칸이 이미 빠졌다
  leavingByBack = true;
  exit();
  leavingByBack = false;
});
window.addEventListener('beforeunload', e => {
  if (!guarded || S.saved || S.solved === 0) return;
  e.preventDefault();
  e.returnValue = '';
});

function exit(after) {
  if (typeof after !== 'string') after = undefined;   // 'again' | 'next' | 'challenge' | 없음
  stopTimer();
  // '한 번 더'는 곧바로 새 도전을 시작하므로 쌓아 둔 칸을 그대로 넘겨준다.
  // (history.back() 은 비동기라, 치우고 바로 새 칸을 쌓으면 뒤늦은 '뒤로'가 새 도전을 끝내 버린다)
  if (guarded && !leavingByBack && after !== 'again' && after !== 'challenge') {   // '그만하기'·'목록으로'로 나갈 때는 쌓아 둔 칸을 치운다
    guarded = false;
    try { history.back(); } catch (e) {}
  }
  // 자유 연습과 중도 포기한 도전도 '푼 기록'은 남긴다.
  // 둘 다 점수가 null 이라 랭킹에는 영향이 없다. 중도 포기한 도전의 문제별 정오(seq)는 통과 판정에 그대로 들어간다.
  DB.clearDraft();
  if (!S.saved && S.solved > 0) { S.saved = true; DB.saveResult(App.classCode, buildPayload()).catch(() => {}); }
  const area = document.getElementById('practiceArea');
  area.classList.add('hidden'); area.innerHTML = '';
  if (S.onExit) S.onExit(after);
}

window.Session = {
  state: S, start, isChallenge, isSkipTest, skipFinishHTML, elapsed,
  headerHTML, updateSolved, startTimer, stopTimer, penalize,
  problemDone, finishHTML, saveResult, exit, windowHTML
};
})();
