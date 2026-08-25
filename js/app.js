/* app.js — 학생 흐름 (반 코드 → 학생 선택 → PIN → 레벨 → 연습) */
const App = (() => {
const L = window.Levels;

const state = {
  classCode: null, className: '',
  studentNo: null, studentName: '',
  level: null, bestScores: {}, chart: null
};

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const SCREENS = ['classEntry','studentSelection','studentPinScreen','levelSelection','modeSelection',
                 'practiceArea','historyArea','rankingArea',
                 'teacherLogin','teacherHome','teacherClass'];
function only(...ids) { SCREENS.forEach(hide); ids.forEach(show); }

const remember = {
  get() { try { return localStorage.getItem('mp.lastClass') || ''; } catch (e) { return ''; } },
  set(v) { try { localStorage.setItem('mp.lastClass', v); } catch (e) {} },
  clear() { try { localStorage.removeItem('mp.lastClass'); } catch (e) {} }
};

/* ═══ 부팅 ═══ */
function boot() {
  DB.init();
  if (DB.isLocal()) $('localBanner').classList.remove('hidden');

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
    remember.set(cls.code);
    const badge = $('classBadge');
    badge.textContent = `${cls.name} · 코드 ${cls.code}`;
    badge.classList.remove('hidden');
    loadStudents(studentParam);
  }).catch(() => showClassEntry('반 정보를 불러오지 못했습니다. 잠시 후 다시 해주세요.'));
}

function leaveClass() {
  remember.clear();
  state.classCode = null; state.studentNo = null;
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
        state.studentNo = found.number; state.studentName = found.name;
        $('gameTitle').textContent = `${found.name} 학생의 연산 마스터`;
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
    b.className = 'p-2 bg-white border border-gray-200 rounded-lg text-sm font-bold hover:bg-orange-100 hover:border-orange-300 transition break-keep';
    b.textContent = `${s.number}. ${s.name}`;
    b.onclick = () => selectStudent(s.number, s.name, b);
    wrap.appendChild(b);
  });
}

function selectStudent(no, name, btn) {
  state.studentNo = no; state.studentName = name;
  document.querySelectorAll('#studentButtons button').forEach(b => b.classList.remove('ring-2','ring-orange-400','bg-orange-50'));
  btn.classList.add('ring-2','ring-orange-400','bg-orange-50');
  const go = $('goToPinBtn');
  go.disabled = false;
  go.classList.replace('bg-gray-300','bg-orange-500');
  $('gameTitle').textContent = `${name} 학생의 연산 마스터`;
}

/* ═══ 학생 PIN ═══ */
function goToPin() {
  only('studentPinScreen');
  $('studentPinTitle').textContent = `${state.studentName} 학생, 비밀번호를 입력하세요`;
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
  state.studentNo = null; state.studentName = '';
  $('gameTitle').textContent = '분수 연산 마스터';
  const go = $('goToPinBtn');
  go.disabled = true; go.classList.replace('bg-orange-500','bg-gray-300');
  loadStudents('');
}

/* ═══ 레벨 ═══ */
function loadLevels() {
  DB.getBestScores(state.classCode, state.studentNo)
    .then(s => { state.bestScores = s || {}; })
    .catch(() => { state.bestScores = {}; })
    .then(() => { renderLevelButtons(); only('levelSelection'); });
}

function renderLevelButtons() {
  const container = $('levelList');
  container.innerHTML = '';
  let group = '', groupDiv = null;

  L.LEVEL_ORDER.forEach(lv => {
    const cfg = L.LEVEL_CONFIGS[lv], t = cfg.theme;
    const max = L.LEVEL_MAX[lv], best = state.bestScores[lv] || 0;
    const unlocked = L.isLevelUnlocked(lv, state.bestScores);

    if (cfg.group !== group) {
      group = cfg.group;
      const section = document.createElement('div');
      section.innerHTML = `<h3 class="text-sm font-black text-gray-500 mb-2 px-1">${L.GROUP_LABELS[group]}</h3>`;
      groupDiv = document.createElement('div');
      groupDiv.className = 'flex flex-col gap-2';
      section.appendChild(groupDiv);
      container.appendChild(section);
    }

    const badge = best >= max
      ? '<span class="lv-badge bg-green-100 text-green-700">✅ 만점</span>'
      : best > 0 ? `<span class="lv-badge bg-yellow-100 text-yellow-700">최고 ${best}점</span>` : '';
    const lock = unlocked ? '' : '<span class="lv-badge bg-gray-200 text-gray-500">🔒 도전 잠김</span>';
    const kind = cfg.engine === 'choice' ? '⚡ 4지선다' : '📝 단계 풀이';

    const btn = document.createElement('button');
    btn.className = `w-full py-3 ${t.bg} border-2 ${t.border} rounded-2xl ${t.hbg} transition text-left px-4`;
    btn.onclick = () => selectLevel(lv);
    btn.innerHTML = `<span class="font-black ${t.lbl}">${lv}</span>
      <span class="${t.descCls} text-sm">${kind} ${cfg.label} (만점 ${max})</span>${badge}${lock}`;
    groupDiv.appendChild(btn);
  });
}

function selectLevel(lv) {
  state.level = lv;
  const cfg = L.LEVEL_CONFIGS[lv];
  $('modeTitle').textContent = `${lv} — ${cfg.label}`;
  $('modeDesc').textContent = cfg.desc;

  const unlocked = L.isLevelUnlocked(lv, state.bestScores);
  const btn = $('challengeBtn'), title = $('challengeTitle'), info = $('challengeInfo');
  if (unlocked) {
    btn.disabled = false;
    btn.onclick = () => startPractice('challenge');
    btn.className = 'w-full py-5 bg-red-50 border-2 border-red-200 rounded-2xl hover:bg-red-100 hover:border-red-400 transition text-left px-5';
    title.textContent = '🔥 도전 연습';
    title.className = 'text-lg font-black text-red-800';
    info.textContent = `${cfg.chalQ}문제 · 제한시간 ${cfg.chalTime}초 · 점수 기록됨`;
    info.className = 'text-sm text-red-600 mt-1';
  } else {
    const prev = L.getPrevLevelInfo(lv, state.bestScores);
    btn.disabled = true;
    btn.onclick = null;
    btn.className = 'w-full py-5 bg-gray-100 border-2 border-gray-200 rounded-2xl text-left px-5 opacity-60 cursor-not-allowed';
    title.textContent = '🔒 도전 연습 (잠김)';
    title.className = 'text-lg font-black text-gray-400';
    const goal = prev.need >= prev.max ? `만점(${prev.max}점)` : `${prev.need}점`;
    info.textContent = `${prev.level} ${goal}에 도달해야 열려요 — 현재 ${prev.best}점`;
    info.className = 'text-sm text-gray-400 mt-1';
  }

  only('modeSelection', 'historyArea', 'rankingArea');
  loadHistoryAndRanking();
}

function startPractice(mode) {
  const cfg = L.LEVEL_CONFIGS[state.level];
  only('practiceArea');
  const back = () => backToLevels();
  if (cfg.engine === 'choice') Quiz.init(state.level, mode, cfg, back);
  else                         StepFrac.init(state.level, mode, cfg, back);
}

function backToLevels() {
  DB.invalidate();
  DB.getBestScores(state.classCode, state.studentNo)
    .then(s => { state.bestScores = s || {}; })
    .catch(() => {})
    .then(() => { renderLevelButtons(); only('levelSelection'); });
}

/* ═══ 성장 그래프 · 랭킹 ═══ */
function loadHistoryAndRanking() {
  $('chartLoading').classList.remove('hidden');
  Promise.all([DB.getHistory(state.classCode, state.studentNo), DB.getRanking(state.classCode, 5)]).then(([hist, rank]) => {
    $('chartLoading').classList.add('hidden');
    renderDelta(hist);
    renderChart(hist);
    renderRankingTable('rankingTableBody', rank, '아직 랭킹이 없습니다.');
  }).catch(() => {
    $('chartLoading').classList.add('hidden');
    renderRankingTable('rankingTableBody', [], '랭킹을 불러오지 못했습니다.');
  });
}

function renderDelta(hist) {
  const box = $('deltaBox');
  if (hist.length < 2) { box.innerHTML = '<div class="text-center text-sm text-gray-400 mb-2">점수 기록이 쌓이면 변화를 보여드려요!</div>'; return; }
  const cur = hist[hist.length - 1].score, prev = hist[hist.length - 2].score, d = cur - prev;
  const cls = d > 0 ? 'text-red-500' : d < 0 ? 'text-blue-500' : 'text-gray-500';
  const icon = d > 0 ? '▲' : d < 0 ? '▼' : '−';
  box.innerHTML = `<div class="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm mb-2 border-l-4 border-orange-400">
    <div class="text-sm text-gray-500">지난 <b>${prev}</b></div>
    <div class="font-bold text-lg ${cls}">${icon} ${Math.abs(d).toFixed(1)}점</div>
    <div class="text-sm text-gray-800">최근 <b>${cur}</b></div></div>`;
}

function renderChart(hist) {
  if (typeof Chart === 'undefined') return;
  const ctx = $('historyChart').getContext('2d');
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: 'line',
    data: { labels: hist.map(h => h.label),
            datasets: [{ label:'내 점수', data: hist.map(h => h.score),
                         borderColor:'#f97316', backgroundColor:'rgba(249,115,22,0.1)', fill:true, tension:0.3 }] },
    options: { responsive:true, maintainAspectRatio:false }
  });
}

/** 순위 표 렌더 (교사 화면에서도 재사용) */
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
      <td class="px-4 py-3 text-right font-bold text-orange-600">${it.score}</td>`;
    tb.appendChild(tr);
  });
}

return {
  boot,
  get classCode() { return state.classCode; },
  get className() { return state.className; },
  get studentNo() { return state.studentNo; },
  get studentName() { return state.studentName; },
  only, showClassEntry, submitClassCode, leaveClass,
  goToPin, submitStudentPin, backToStudents,
  selectLevel, startPractice, backToLevels,
  renderRankingTable
};
})();

document.addEventListener('DOMContentLoaded', App.boot);
