/* app.js — 학생 흐름 (반 코드 → 학생 선택 → PIN → 레벨 → 연습) */
const App = (() => {
const L = window.Levels;

const state = {
  classCode: null, className: '',
  studentNo: null, studentName: '',
  level: null, bestScores: {},
  basicStart: {},   // 번호별 기초 트랙 시작점 — 교사 화면 설정에서 정한다(반 문서 basicStart). 없으면 시작점 없음
  progress: { passed: {}, recent: {} },   // 통과한 레벨 · 레벨별 최근 문제 정오 (규칙은 levels.js)
  loadFailed: false   // 기록 읽기 실패 — 0점으로 덮어쓰지 않고 경고를 띄운다
};

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const SCREENS = ['classEntry','studentSelection','studentPinScreen','levelSelection','modeSelection',
                 'practiceArea',
                 'teacherLogin','teacherHome','teacherClass'];
/** 화면 하나만 보이기. 문제를 푸는 동안에는 위쪽 제목줄도 숨겨 문제가 화면 위로 올라오게 한다 */
function only(...ids) {
  SCREENS.forEach(hide); ids.forEach(show);
  $('appHeader').classList.toggle('hidden', ids.includes('practiceArea'));
}
const titleFor = no => `${no}번 · 연산 마스터`;

const remember = {
  get() { try { return localStorage.getItem('mp.lastClass') || ''; } catch (e) { return ''; } },
  set(v) { try { localStorage.setItem('mp.lastClass', v); } catch (e) {} },
  clear() { try { localStorage.removeItem('mp.lastClass'); } catch (e) {} }
};

/** 마지막으로 서버에서 확인한 레벨 최고점·통과 여부 — 기록 읽기가 실패했을 때만 꺼내 쓴다 */
const bestBackup = {
  key() { return `mp.best.${state.classCode}.${state.studentNo}`; },
  get() { try { return JSON.parse(localStorage.getItem(bestBackup.key())) || null; } catch (e) { return null; } },
  set(v) { try { localStorage.setItem(bestBackup.key(), JSON.stringify(v)); } catch (e) {} }
};

/** 학생이 바뀌면 앞 학생의 점수를 지운다 — 같은 기기에서 읽기에 실패했을 때 앞 학생 점수가 보이지 않도록 */
function resetStudent() {
  state.studentNo = null; state.studentName = '';
  state.bestScores = {}; state.progress = { passed: {}, recent: {} }; state.loadFailed = false;
}

/* ═══ 부팅 ═══ */
function boot() {
  DB.init();
  if (DB.isLocal()) $('localBanner').classList.remove('hidden');
  DB.startBackgroundSync();   // 지난번에 풀다 끊긴 기록 · 못 보낸 기록을 다시 올린다

  const params = new URLSearchParams(location.search);
  if (params.get('view') === 'teacher') { Teacher.autoRoute(); return; }

  const code = (params.get('class') || remember.get() || '').toUpperCase().trim();
  const studentParam = params.get('student') || '';
  if (!code) { showClassEntry(); return; }
  enterClass(code, studentParam, !params.get('class'));
}

function showClassEntry(msg) {
  only('classEntry');
  $('classBadge').classList.add('hidden');
  $('gameTitle').textContent = '분수 연산 마스터';
  $('classCodeMessage').textContent = msg || '';
  $('classCodeInput').value = '';
  $('classCodeInput').focus();
}

function submitClassCode() {
  const code = $('classCodeInput').value.toUpperCase().trim();
  if (code.length !== 6) { $('classCodeMessage').textContent = '반 코드는 6자리입니다.'; return; }
  $('classCodeMessage').textContent = '확인 중...';
  enterClass(code, '', false);
}

function enterClass(code, studentParam, silentFail) {
  DB.getClass(code).then(cls => {
    if (!cls) {
      if (silentFail) { remember.clear(); showClassEntry(); }
      else showClassEntry('반을 찾을 수 없어요. 코드를 다시 확인해 주세요.');
      return;
    }
    state.classCode = cls.code;
    state.className = cls.name;
    state.basicStart = cls.basicStart || {};
    remember.set(cls.code);
    const badge = $('classBadge');
    badge.textContent = `${cls.name} · 코드 ${cls.code}`;
    badge.classList.remove('hidden');
    loadStudents(studentParam);
  }).catch(() => showClassEntry('반 정보를 불러오지 못했습니다. 잠시 후 다시 해주세요.'));
}

function leaveClass() {
  remember.clear();
  state.classCode = null;
  resetStudent();
  history.replaceState(null, '', location.pathname);
  showClassEntry();
}

/* ═══ 학생 선택 ═══ */
function loadStudents(studentParam) {
  only('studentSelection');
  DB.getStudents(state.classCode).then(list => {
    renderStudentButtons(list);
    if (studentParam) {
      const found = list.find(s => String(s.number) === String(studentParam));
      if (found) {
        resetStudent();
        state.studentNo = found.number; state.studentName = found.name;
        $('gameTitle').textContent = titleFor(found.number);
        DB.verifyStudentPin(state.classCode, found.number, '').then(r => {
          if (r.ok) loadLevels(); else goToPin();
        });
      }
    }
  }).catch(err => {
    $('studentButtons').innerHTML =
      `<div class="col-span-full text-red-500 text-sm py-4">학생 명단을 불러오지 못했습니다.<br><span class="text-xs text-gray-400">${err.message || err}</span></div>`;
  });
}

function renderStudentButtons(list) {
  const wrap = $('studentButtons');
  wrap.innerHTML = '';
  if (!list.length) { wrap.innerHTML = '<div class="col-span-full text-gray-500 py-4">아직 등록된 학생이 없어요. 선생님께 알려주세요!</div>'; return; }
  list.forEach(s => {
    const b = document.createElement('button');
    b.className = 'p-2 bg-white border border-gray-200 rounded-lg text-sm font-bold stu-btn transition break-keep';
    b.textContent = `${s.number}. ${s.name}`;
    b.onclick = () => selectStudent(s.number, s.name, b);
    wrap.appendChild(b);
  });
}

function selectStudent(no, name, btn) {
  resetStudent();
  state.studentNo = no; state.studentName = name;
  document.querySelectorAll('#studentButtons button').forEach(b => b.classList.remove('stu-on'));
  btn.classList.add('stu-on');
  const go = $('goToPinBtn');
  go.disabled = false;
  go.classList.replace('bg-gray-300','btn-main');
  $('gameTitle').textContent = titleFor(no);
}

/* ═══ 학생 PIN ═══ */
function goToPin() {
  only('studentPinScreen');
  $('studentPinTitle').textContent = `${state.studentNo}번, 비밀번호를 써요`;
  $('studentPinInput').value = '';
  $('studentPinMessage').textContent = '';
  $('studentPinInput').focus();
}

function submitStudentPin() {
  const pin = $('studentPinInput').value.trim();
  const msg = $('studentPinMessage'), btn = $('studentPinSubmitBtn');
  msg.textContent = '확인 중...'; msg.className = 'h-6 mt-3 text-sm font-bold text-gray-500';
  btn.disabled = true; btn.textContent = '확인 중...';
  DB.verifyStudentPin(state.classCode, state.studentNo, pin).then(r => {
    btn.disabled = false; btn.textContent = '확인';
    if (!r.ok) { msg.textContent = r.message || '인증 실패'; msg.className = 'h-6 mt-3 text-sm font-bold text-red-500'; return; }
    msg.textContent = '';
    loadLevels();
  }).catch(() => {
    btn.disabled = false; btn.textContent = '확인';
    msg.textContent = '인증 중 오류가 발생했습니다.'; msg.className = 'h-6 mt-3 text-sm font-bold text-red-500';
  });
}

function backToStudents() {
  resetStudent();
  $('gameTitle').textContent = '분수 연산 마스터';
  const go = $('goToPinBtn');
  go.disabled = true; go.classList.replace('btn-main','bg-gray-300');
  loadStudents('');
}

/* ═══ 레벨 ═══ */
function loadLevels() {
  fetchBestScores().then(() => { renderLevelButtons(); only('levelSelection'); });
}

/** 최고점 읽기. 실패하면 빈 기록으로 덮지 않는다 — 화면에 있던 점수나 기기 백업을 그대로 쓴다.
 *  (예전에는 실패 = 빈 기록이라, Firestore 읽기 한도가 바닥나면 다 푼 학생도 '초기화'된 것처럼 보였다) */
function fetchBestScores() {
  return DB.getProgress(state.classCode, state.studentNo)
    .then(p => {
      state.bestScores = p.best || {};
      state.progress = { passed: p.passed || {}, recent: p.recent || {} };
      state.loadFailed = false;
      bestBackup.set({ best: state.bestScores, passed: state.progress.passed, recent: state.progress.recent });
    })
    .catch(err => {
      console.warn('기록 읽기 실패', err);
      state.loadFailed = true;
      if (Object.keys(state.bestScores).length) return;
      const b = bestBackup.get() || {};
      if (b.best && b.passed) {
        state.bestScores = b.best;
        state.progress = { passed: b.passed, recent: b.recent || {} };
      } else {
        // 예전 형식의 백업(레벨 최고점만) — 예전 규칙의 통과 점수로 통과 여부를 되살린다
        state.bestScores = b;
        const passed = {};
        Object.keys(b).forEach(lv => { if (L.LEVEL_CONFIGS[lv] && b[lv] >= L.unlockThreshold(lv)) passed[lv] = true; });
        state.progress = { passed, recent: {} };
      }
    });
}

function retryLoadLevels() {
  $('levelList').innerHTML = '<div class="text-center text-sm text-gray-500 py-4">다시 불러오는 중...</div>';
  DB.invalidate();
  loadLevels();
}

/** 분수·소수 트랙에서 할 것 — 아직 통과하지 못한 레벨 중 도전이 열린 첫 레벨. 다 통과했으면 null */
function nextLevel() {
  return L.LEVEL_ORDER.find(lv => !state.progress.passed[lv] && L.isLevelUnlocked(lv, state.progress.passed)) || null;
}
/** 같은 트랙(기초는 같은 줄)에서 바로 다음 레벨 (결과 화면의 '다음 레벨로' 버튼) */
function levelAfter(lv) { return L.nextInTrack(lv); }

/* ═══ 기초 트랙 시작점 ═══
 * 반 문서의 basicStart = { '번호': { sub, mul, div, g } }  (값: 'B1'~'B8' 또는 '-' = 그 줄은 통과)
 * 약수와 배수(B9·B10)는 모두가 거친다. 묶음 g: 가 = 기초만(B3 통과 전까지), 나 = 기초 먼저, 다·라 = 분수 먼저
 */
const myStart = () => state.basicStart[String(state.studentNo)] || null;
const isSkippedByStart = lv => L.basicSkipped(myStart(), lv);
const doneBasic = lv => !!state.progress.passed[lv] || isSkippedByStart(lv);
const nextBasic = () => L.nextBasicLevel(myStart(), state.progress.passed);
/** 오늘 할 것 — [첫째, 둘째] (없으면 빠짐) */
function todayLevels() {
  const b = nextBasic(), f = nextLevel(), p = myStart();
  const g = p && p.g;
  let list;
  if (g === '가' && !doneBasic('B3')) list = [b];
  else if (g === '가' || g === '나') list = [b, f];
  else list = [f, b];
  return list.filter(Boolean);
}

/** 오늘 할 것 화면 — 맨 위에 다음 도전 하나를 크게, 아래에 레벨 칩. 다 끝낸 묶음은 접어 둔다.
 *  잠긴 레벨도 누르면 카드에서 무엇을 먼저 통과해야 하는지 보여 준다. 잠금 계산은 levels.js 그대로.
 *  (자유 연습 버튼은 2026-11-17 선생님 결정으로 뺐다 — 학생 화면은 '도전' 하나. 예전 free 기록은 그대로 남고 읽힌다) */
function renderLevelButtons() {
  const container = $('levelList');
  container.innerHTML = '';

  if (state.loadFailed) {
    const hasAny = Object.keys(state.bestScores).length > 0;
    const warn = document.createElement('div');
    warn.className = 'bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-sm text-amber-800 font-bold';
    warn.innerHTML = `⚠️ 기록을 불러오지 못했어요. ${hasAny ? '이 기기에 남아 있던 마지막 기록을 보여 주고 있어요.' : '잠겨 보여도 기록은 지워지지 않았어요.'}
      <button class="mt-2 w-full py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition" onclick="App.retryLoadLevels()">🔄 다시 불러오기</button>`;
    container.appendChild(warn);
  }

  const today = todayLevels();
  const next = today[0] || null, second = today[1] || null;
  const card = document.createElement('div');
  card.className = 'next-card';
  if (next) {
    const cfg = L.LEVEL_CONFIGS[next];
    card.innerHTML = `<span class="next-k">오늘 할 것</span>
      <button class="next-t" data-act="card"><b>${next}</b>${cfg.label}</button>
      ${Session.windowHTML(next, state.progress.recent[next] || [], false)}
      <button class="big-btn big-go" data-act="go">🔥 도전 시작</button>
      ${second ? `<button class="next-sub" data-act="second">그다음 <b>${second}</b>${L.LEVEL_CONFIGS[second].label}</button>` : ''}`;
    card.querySelector('[data-act=card]').onclick = () => selectLevel(next);
    card.querySelector('[data-act=go]').onclick = () => { state.level = next; startPractice('challenge'); };
    if (second) card.querySelector('[data-act=second]').onclick = () => selectLevel(second);
  } else {
    card.innerHTML = `<span class="next-k">오늘 할 것</span>
      <div class="next-t">모든 레벨을 통과했어요! 🎉</div>
      <div class="text-sm font-bold t-main">아래에서 다시 풀고 싶은 레벨을 골라요.</div>`;
  }
  container.appendChild(card);

  // 트랙별로, 그 안에서 묶음(그룹)별로 칩을 만든다
  const groupsOf = levels => {
    const groups = [];
    levels.forEach(lv => {
      const g = L.LEVEL_CONFIGS[lv].group;
      if (!groups.length || groups[groups.length - 1].key !== g) groups.push({ key: g, levels: [] });
      groups[groups.length - 1].levels.push(lv);
    });
    return groups;
  };
  const isDone = lv => !!state.progress.passed[lv] || isSkippedByStart(lv);
  const groupEl = g => {
    const done = g.levels.filter(isDone).length;
    const el = document.createElement('div');
    el.className = 'lv-grp';
    el.innerHTML = `<div class="lv-gh"><span>${L.GROUP_LABELS[g.key]}</span><span>${done}/${g.levels.length}</span></div><div class="lv-chips"></div>`;
    const chips = el.querySelector('.lv-chips');
    g.levels.forEach(lv => {
      const passed = !!state.progress.passed[lv];
      const skipped = !passed && isSkippedByStart(lv);
      const unlocked = L.isLevelUnlocked(lv, state.progress.passed);
      const b = document.createElement('button');
      b.className = 'lv-chip ' + (lv === next ? 'now' : passed ? 'done' : skipped ? 'skip' : unlocked ? '' : 'lock');
      b.textContent = lv + (passed ? ' ✓' : skipped ? ' ⤼' : unlocked ? '' : ' 🔒');
      b.title = L.LEVEL_CONFIGS[lv].label + (skipped ? ' (시작점 앞 — 건너뛰어도 돼요)' : '');
      b.onclick = () => selectLevel(lv);
      chips.appendChild(b);
    });
    return el;
  };

  L.TRACK_KEYS.forEach(t => {
    const tr = L.TRACKS[t];
    const head = document.createElement('div');
    head.className = 'lv-track';
    head.textContent = tr.label + (tr.open ? ' · 언제든 풀 수 있어요' : '');
    container.appendChild(head);
    const groups = groupsOf(tr.levels);
    const finished = groups.filter(g => g.levels.every(isDone));
    groups.filter(g => !finished.includes(g)).forEach(g => container.appendChild(groupEl(g)));
    if (finished.length) {
      const fold = document.createElement('details');
      fold.className = 'lv-fold';
      const first = finished[0].levels[0], lastG = finished[finished.length - 1];
      fold.innerHTML = `<summary>끝낸 레벨 ${first}~${lastG.levels[lastG.levels.length - 1]} 보기</summary><div></div>`;
      finished.forEach(g => fold.lastElementChild.appendChild(groupEl(g)));
      container.appendChild(fold);
    }
  });
}

/** 레벨 카드 — 이름 · 짧은 설명 · 푼 예시 하나 · 최근 문제 점 · 도전 버튼 */
function selectLevel(lv) {
  state.level = lv;
  const cfg = L.LEVEL_CONFIGS[lv];
  $('modeLevel').textContent = lv;
  $('modeTitle').textContent = cfg.label;
  $('modeDesc').textContent = cfg.desc;
  $('modeExample').innerHTML = exampleHTML(lv, cfg);

  const unlocked = L.isLevelUnlocked(lv, state.progress.passed);
  const passed = !!state.progress.passed[lv];
  $('modeWindow').innerHTML = unlocked ? Session.windowHTML(lv, state.progress.recent[lv] || [], passed) : '';
  const btn = $('challengeBtn');
  if (unlocked) {
    btn.disabled = false;
    btn.onclick = () => startPractice('challenge');
    btn.className = 'big-btn big-go';
    btn.innerHTML = `🔥 도전 (${cfg.chalQ}문제)`;
  } else {
    const prev = L.getPrevLevelInfo(lv, state.progress);
    btn.disabled = true;
    btn.onclick = null;
    btn.className = 'big-btn big-lock';
    btn.innerHTML = `🔒 ${prev.level} 먼저 통과해요<small>${prev.level} 도전 최근 ${prev.size}문제 중 ${prev.need}개 · 지금 ${prev.correct}개</small>`;
  }
  only('modeSelection');
}

/** 4지선다 레벨은 문제 하나를 만들어 정답과 함께 보여 준다 (설명을 덜 읽어도 할 일이 보이게). 과정형은 생략 */
function exampleHTML(lv, cfg) {
  if (cfg.engine === 'num') {
    try {
      const q = Gen.generateNumProblem(lv);
      const ans = q.fields.map(f => (f.label ? f.label + ' ' : '') + (f.list ? f.ans.join(', ') : f.ans)).join(' · ');
      return `<div class="ex-box"><span class="ex-lbl">예시</span><div class="quiz-q num-q">${q.display}</div>
        <div class="ex-ans">정답 ➜ ${ans}</div></div>`;
    } catch (e) { return ''; }
  }
  if (cfg.engine !== 'choice') return '';
  try {
    const q = Gen.generateChoiceSet(lv, 1)[0];
    const ans = q.choices.find(c => c.correct);
    if (!ans) return '';
    return `<div class="ex-box"><span class="ex-lbl">예시</span><div class="quiz-q">${q.display}</div>
      <div class="ex-ans">정답 ➜ ${ans.html}</div></div>`;
  } catch (e) { return ''; }
}

function startPractice(mode) {
  const cfg = L.LEVEL_CONFIGS[state.level];
  only('practiceArea');
  const back = after => backToLevels(after);
  if (cfg.engine === 'choice')   Quiz.init(state.level, mode, cfg, back);
  else if (cfg.engine === 'num') NumInput.init(state.level, mode, cfg, back);
  else                           StepFrac.init(state.level, mode, cfg, back);
}

/** 연습이 끝나고 돌아올 때. after = 'again'(한 번 더) | 'next'(다음 레벨 카드) | 없음(목록) */
function backToLevels(after) {
  // 방금 저장한 기록은 db.js 가 캐시에 덧붙여 두므로 캐시를 비우지 않는다 (비우면 기록을 전부 다시 읽음)
  const lv = state.level;
  fetchBestScores().then(() => {
    renderLevelButtons();
    if (after === 'again' && lv) { state.level = lv; startPractice('challenge'); }
    else if (after === 'next' && levelAfter(lv)) selectLevel(levelAfter(lv));
    else only('levelSelection');
  });
}

/** 순위 표 렌더 (교사 화면에서도 재사용) — 점수는 레벨별 최고점의 합계, 레벨은 도달한 최고 레벨 */
function renderRankingTable(tbodyId, list, emptyMsg) {
  const tb = $(tbodyId);
  tb.innerHTML = '';
  if (!list.length) { tb.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">${emptyMsg}</td></tr>`; return; }
  list.forEach(it => {
    const medal = { '1등':'🥇', '2등':'🥈', '3등':'🥉' }[it.rank] || it.rank;
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-yellow-50';
    tr.innerHTML = `<td class="px-4 py-3 text-center font-bold text-gray-700">${medal}</td>
      <td class="px-4 py-3 font-medium text-gray-900">${it.name}</td>
      <td class="px-4 py-3 text-center"><span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">${it.level}</span></td>
      <td class="px-4 py-3 text-right font-bold text-orange-600">${it.score}<div class="text-xs font-normal text-gray-400">${it.levels}개 레벨</div></td>`;
    tb.appendChild(tr);
  });
}

return {
  boot,
  get classCode() { return state.classCode; },
  get className() { return state.className; },
  get studentNo() { return state.studentNo; },
  get studentName() { return state.studentName; },
  recentOf(lv) { return state.progress.recent[lv] || []; },
  isPassed(lv) { return !!state.progress.passed[lv]; },
  only, showClassEntry, submitClassCode, leaveClass,
  goToPin, submitStudentPin, backToStudents,
  selectLevel, startPractice, backToLevels, retryLoadLevels, levelAfter,
  renderRankingTable
};
})();

document.addEventListener('DOMContentLoaded', App.boot);
